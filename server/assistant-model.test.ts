import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  assistantAvailable,
  assistantJson,
  readLimitedJson,
} from "./assistantModel";

const schema = z.object({ answer: z.string() }).strict();
const response = (patch = {}) =>
  new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: '{"answer":"Hello"}' }],
        },
      ],
      ...patch,
    })
  );
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("server-only OpenAI adapter", () => {
  it("does not impersonate working AI without an explicitly configured OpenAI key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "unused-test-key");
    expect(assistantAvailable()).toBe(false);
    await expect(
      assistantJson("test", schema, "rules", "input")
    ).rejects.toThrow("unconfigured");
  });
  it("sends strict schemas without storing responses or exposing the key to clients", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key-not-a-real-secret");
    vi.stubEnv("BEACON_AI_ENABLED", "true");
    vi.stubEnv("OPENAI_MODEL", "gpt-5-mini");
    const fetcher = vi.fn(async () => response());
    vi.stubGlobal("fetch", fetcher);
    expect(await assistantJson("test", schema, "rules", "input")).toEqual({
      answer: "Hello",
    });
    const [url, request] = fetcher.mock.calls[0]! as any;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(request.redirect).toBe("error");
    expect(request.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({
      store: false,
      max_output_tokens: 2000,
      text: {
        format: {
          strict: true,
          type: "json_schema",
          schema: { additionalProperties: false },
        },
      },
    });
    expect(request.body).not.toContain("test-key-not-a-real-secret");
  });
  it("rejects refusals, truncated outputs, invalid JSON and invalid structured results", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubEnv("BEACON_AI_ENABLED", "true");
    for (const patch of [
      { status: "incomplete" },
      {
        output: [
          { type: "message", content: [{ type: "refusal", refusal: "No" }] },
        ],
      },
      {
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "not json" }],
          },
        ],
      },
      {
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: '{"answer":42}' }],
          },
        ],
      },
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response(patch))
      );
      await expect(
        assistantJson("test", schema, "rules", "input")
      ).rejects.toThrow();
    }
  });
  it("does not retry billable failures or expose upstream error bodies", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubEnv("BEACON_AI_ENABLED", "true");
    const fetcher = vi.fn(
      async () =>
        new Response("upstream-key-or-private-detail", { status: 401 })
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      assistantJson("test", schema, "rules", "input")
    ).rejects.toThrow("unavailable");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(
      readLimitedJson(new Response('"' + "x".repeat(200) + '"'), 100)
    ).rejects.toThrow("Response too large");
  });
});
