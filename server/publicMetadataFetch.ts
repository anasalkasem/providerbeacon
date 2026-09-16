import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request } from "node:https";

const denied = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const)
  denied.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  denied.addSubnet(address, prefix, "ipv6");

export function publicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !denied.check(address, "ipv4");
  return (
    family === 6 &&
    /^[23][a-f\d]{3}:/i.test(address) &&
    !denied.check(address, "ipv6")
  );
}
export function metadataUrl(raw: string, base?: string) {
  if (raw.length > 2048 || /[\s\\\u0000-\u001f]/.test(raw))
    throw new Error("metadata_url");
  const u = new URL(raw, base);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    isIP(u.hostname.replace(/^\[|\]$/g, "")) ||
    !u.hostname.includes(".") ||
    /\.(?:localhost|local|internal|test|invalid|example|onion)\.?$/i.test(
      u.hostname
    )
  )
    throw new Error("metadata_url");
  u.hash = "";
  return u;
}
export async function resolveMetadataUrl(raw: string, remainingMs = 8000) {
  const url = metadataUrl(raw);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = await Promise.race([
      lookup(url.hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("metadata_timeout")),
          remainingMs
        );
      }),
    ]);
    if (
      !addresses.length ||
      addresses.some(value => !publicAddress(value.address))
    )
      throw new Error("metadata_private_address");
    // Railway's service has IPv6 egress disabled. Still validate every DNS answer.
    const selected =
      addresses.find(value => value.family === 4) ?? addresses[0];
    return { url, address: selected.address, family: selected.family };
  } finally {
    clearTimeout(timer);
  }
}

export type PublicFetchResult = {
  body: Buffer;
  contentType: string;
  url: string;
};
// DNS is pinned to the validated IP for the actual TLS connection. No cookies,
// API credentials, proxy environment variables, or browser sessions are forwarded.
export async function fetchPublicMetadata(
  raw: string,
  options: {
    maxBytes: number;
    timeoutMs?: number;
    html?: boolean;
    json?: boolean;
  }
): Promise<PublicFetchResult> {
  const deadline = Date.now() + (options.timeoutMs ?? 12000);
  let target = raw;
  for (let hop = 0; hop <= 3; hop++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("metadata_timeout");
    const pinned = await resolveMetadataUrl(target, Math.min(remaining, 6000));
    const response = await new Promise<
      PublicFetchResult | { location: string }
    >((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const req = request(
        {
          hostname: pinned.address,
          family: pinned.family,
          servername: pinned.url.hostname,
          port: 443,
          method: "GET",
          path: pinned.url.pathname + pinned.url.search,
          agent: false,
          rejectUnauthorized: true,
          headers: {
            Host: pinned.url.host,
            "User-Agent":
              "ProviderBeaconMetadata/1.0 (+https://providerbeacon.com)",
            Accept: options.json
              ? "application/json"
              : options.html
                ? "text/html,application/xhtml+xml"
                : "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon",
            "Accept-Encoding": "identity",
          },
        },
        res => {
          const status = res.statusCode ?? 0;
          if (status === 401 || status === 403) {
            req.destroy(new Error("metadata_protected"));
            return;
          }
          if (status === 429) {
            req.destroy(new Error("metadata_source_busy"));
            return;
          }
          if (
            [301, 302, 303, 307, 308].includes(status) &&
            res.headers.location
          ) {
            clearTimeout(timer);
            res.destroy();
            try {
              resolve({
                location: new URL(res.headers.location, pinned.url).href,
              });
            } catch {
              reject(new Error("metadata_redirect"));
            }
            return;
          }
          const contentType = (res.headers["content-type"] ?? "")
            .split(";")[0]
            .trim()
            .toLowerCase();
          if (
            status !== 200 ||
            (res.headers["content-encoding"] &&
              res.headers["content-encoding"] !== "identity") ||
            (options.html &&
              !["text/html", "application/xhtml+xml"].includes(contentType)) ||
            (options.json && contentType !== "application/json") ||
            Number(res.headers["content-length"] ?? 0) > options.maxBytes
          ) {
            req.destroy(new Error("metadata_response"));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > options.maxBytes)
              req.destroy(new Error("metadata_size"));
            else chunks.push(chunk);
          });
          res.on("error", error => {
            clearTimeout(timer);
            reject(error);
          });
          res.on("end", () => {
            clearTimeout(timer);
            resolve({
              body: Buffer.concat(chunks),
              contentType,
              url: pinned.url.href,
            });
          });
        }
      );
      timer = setTimeout(
        () => req.destroy(new Error("metadata_timeout")),
        Math.max(1, deadline - Date.now())
      );
      req.on("error", error => {
        clearTimeout(timer);
        reject(error);
      });
      req.end();
    });
    if ("body" in response) return response;
    target = metadataUrl(response.location).href;
  }
  throw new Error("metadata_redirects");
}
