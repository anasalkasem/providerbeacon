import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  androidAssetLinks,
  registerMobileAssociationRoutes,
} from "./mobileAssociation";

const certificate = Array.from({ length: 32 }, (_, i) =>
  i.toString(16).padStart(2, "0")
).join(":");
let server: Server | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server!.close(error => (error ? reject(error) : resolve()))
    );
    server = undefined;
  }
});

async function requestAssociation() {
  const app = express();
  registerMobileAssociationRoutes(app);
  app.use((_req, res) => res.type("html").send("<main>SPA</main>"));
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test address");
  return fetch(`http://127.0.0.1:${address.port}/.well-known/assetlinks.json`);
}

describe("Android domain association", () => {
  it("trusts no application before the owner supplies a signing certificate", async () => {
    vi.stubEnv("ANDROID_APP_SHA256_FINGERPRINTS", "");
    const response = await requestAssociation();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual([]);
  });

  it("normalizes and deduplicates the configured release certificate only", async () => {
    vi.stubEnv(
      "ANDROID_APP_SHA256_FINGERPRINTS",
      ` ${certificate},${certificate.toUpperCase()} `
    );
    const response = await requestAssociation();
    expect(await response.json()).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.providerbeacon.app",
          sha256_cert_fingerprints: [certificate.toUpperCase()],
        },
      },
    ]);
  });

  it("rejects malformed, empty and oversized certificate sets without partial trust", async () => {
    for (const invalid of [
      "placeholder",
      "00:11",
      certificate.replaceAll(":", ""),
      `${certificate},`,
      `${certificate},untrusted`,
    ]) {
      expect(() => androidAssetLinks(invalid)).toThrow();
    }
    const many = Array.from(
      { length: 6 },
      (_, n) =>
        `${n.toString().padStart(2, "0")}:${certificate.split(":").slice(1).join(":")}`
    ).join(",");
    expect(() => androidAssetLinks(many)).toThrow();
    vi.stubEnv("ANDROID_APP_SHA256_FINGERPRINTS", "placeholder");
    const response = await requestAssociation();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: "App association is not configured correctly",
    });
  });
});
