import { z } from "zod";

export class AssistantModelError extends Error {
  constructor(
    public kind: "unconfigured" | "unavailable" | "invalid_response"
  ) {
    super(kind);
  }
}

export function assistantAvailable() {
  return (
    process.env.BEACON_AI_ENABLED !== "false" &&
    !!process.env.OPENAI_API_KEY?.trim()
  );
}

export function assistantModelName() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
}

export async function readLimitedJson(
  response: Response,
  maxBytes = 128000
): Promise<unknown> {
  if (!response.body) throw new Error("Empty response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw new Error("Response too large");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function assistantJson<T extends z.ZodType>(
  name: string,
  schema: T,
  instructions: string,
  input: string
): Promise<z.infer<T>> {
  if (!assistantAvailable()) throw new AssistantModelError("unconfigured");
  const { $schema: _draft, ...jsonSchema } = z.toJSONSchema(schema);
  const model = assistantModelName();
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(25000),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions,
        input: [{ role: "user", content: input }],
        max_output_tokens: 2000,
        ...(/^gpt-5/.test(model) ? { reasoning: { effort: "low" } } : {}),
        text: {
          format: {
            type: "json_schema",
            name,
            strict: true,
            schema: jsonSchema,
          },
        },
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      // Never expose upstream bodies, keys or customer messages to logs/clients.
      throw new AssistantModelError("unavailable");
    }
    const payload = (await readLimitedJson(response)) as {
      status?: string;
      output?: { type: string; content?: { type: string; text?: string }[] }[];
    };
    if (payload.status !== "completed")
      throw new AssistantModelError("invalid_response");
    const content = (payload.output ?? [])
      .filter(item => item.type === "message")
      .flatMap(item => item.content ?? []);
    if (content.some(part => part.type === "refusal"))
      throw new AssistantModelError("invalid_response");
    const text = content
      .filter(part => part.type === "output_text")
      .map(part => part.text ?? "")
      .join("");
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new AssistantModelError("invalid_response");
    return parsed.data;
  } catch (error) {
    if (error instanceof AssistantModelError) throw error;
    throw new AssistantModelError("unavailable");
  }
}
