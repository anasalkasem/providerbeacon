import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  lookup: vi.fn(),
  request: vi.fn(),
  replies: [] as any[],
  calls: [] as any[],
}));
vi.mock("node:dns/promises", () => ({ lookup: state.lookup }));
vi.mock("node:https", () => ({ request: state.request }));
import { fetchPublicMetadata } from "./publicMetadataFetch";
beforeEach(() => {
  vi.clearAllMocks();
  state.calls = [];
  state.replies = [];
  state.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  state.request.mockImplementation((options, callback) => {
    state.calls.push(options);
    const req = new EventEmitter() as any;
    req.destroy = (error: Error) => {
      queueMicrotask(() => req.emit("error", error));
      return req;
    };
    req.end = () =>
      queueMicrotask(() => {
        const reply = state.replies.shift() ?? { body: "<html>Hello</html>" };
        if (reply.error) {
          req.destroy(reply.error);
          return;
        }
        const res = new PassThrough() as any;
        res.statusCode = reply.status ?? 200;
        res.headers = { "content-type": "text/html", ...reply.headers };
        callback(res);
        if (!res.destroyed) res.end(reply.body ?? "");
      });
    return req;
  });
});
describe("bounded DNS-pinned public metadata transport", () => {
  it("distinguishes a denied source from a transient transport failure", async () => {
    state.replies = [{ status: 403, body: "Just a moment" }];
    await expect(
      fetchPublicMetadata("https://provider.com", {
        html: true,
        maxBytes: 1000,
      })
    ).rejects.toThrow("metadata_restricted");
    expect(state.calls).toHaveLength(1);
  });
  it("pins the checked IP while validating TLS for the original hostname, with no credentials", async () => {
    const result = await fetchPublicMetadata("https://provider.com/home", {
      html: true,
      maxBytes: 1000,
    });
    expect(result.body.toString()).toContain("Hello");
    expect(state.lookup).toHaveBeenCalledTimes(1);
    expect(state.calls[0]).toMatchObject({
      hostname: "93.184.216.34",
      servername: "provider.com",
      rejectUnauthorized: true,
      agent: false,
      method: "GET",
      path: "/home",
    });
    expect(state.calls[0].headers).not.toHaveProperty("Cookie");
    expect(state.calls[0].headers).not.toHaveProperty("Authorization");
  });
  it("rejects a mixed public/private DNS answer before making any connection", async () => {
    state.lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.8", family: 4 },
    ]);
    await expect(
      fetchPublicMetadata("https://provider.com", {
        html: true,
        maxBytes: 1000,
      })
    ).rejects.toThrow("metadata_private_address");
    expect(state.request).not.toHaveBeenCalled();
  });
  it("rechecks redirect destinations and prevents rebinding to a private IP", async () => {
    state.replies = [
      { status: 302, headers: { location: "https://redirect.com/logo" } },
    ];
    state.lookup
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
    await expect(
      fetchPublicMetadata("https://provider.com", { maxBytes: 1000 })
    ).rejects.toThrow("metadata_private_address");
    expect(state.calls).toHaveLength(1);
  });
  it("rejects malformed redirects and redirect loops without uncaught exceptions", async () => {
    state.replies = [{ status: 302, headers: { location: "https://[broken" } }];
    await expect(
      fetchPublicMetadata("https://provider.com", { maxBytes: 1000 })
    ).rejects.toThrow("metadata_redirect");
    state.replies = Array.from({ length: 5 }, () => ({
      status: 302,
      headers: { location: "/again" },
    }));
    await expect(
      fetchPublicMetadata("https://provider.com", { maxBytes: 1000 })
    ).rejects.toThrow("metadata_redirects");
    expect(state.calls).toHaveLength(5);
  });
  it("bounds both declared and streamed bytes and preserves TLS errors", async () => {
    for (const reply of [
      { headers: { "content-length": "2000" } },
      { body: "x".repeat(2000) },
      { error: new Error("CERT_HAS_EXPIRED") },
    ]) {
      state.replies = [reply];
      await expect(
        fetchPublicMetadata("https://provider.com", { maxBytes: 1000 })
      ).rejects.toThrow();
    }
  });
});
