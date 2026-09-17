import { z } from "zod";

export const messageLocales = ["ar", "en", "es", "hi", "zh"] as const;
export type MessageLocale = (typeof messageLocales)[number];
export const messageLocale = z.enum(messageLocales);
export const conversationId = z.string().uuid();
export const conversationCursor = z
  .object({ messageId: z.number().int().nonnegative(), id: conversationId })
  .strict();
export type ConversationCursor = z.infer<typeof conversationCursor>;
export type MessageAlert = {
  conversationId: string;
  kind: "direct" | "support";
  messageId: number;
  name: string | null;
};
export type MessageNotificationSnapshot = {
  unread: number;
  items: MessageAlert[];
};
export const messageText = z.string().trim().min(1).max(2000);
export const sendMessageInput = z
  .object({
    conversationId,
    clientId: z.string().uuid(),
    text: messageText,
    locale: messageLocale,
  })
  .strict();
export const threadInput = z
  .object({
    conversationId,
    before: z.number().int().positive().optional(),
  })
  .strict();
export const handoffInput = z
  .object({
    locale: messageLocale,
    text: messageText,
    clientId: z.string().uuid(),
    name: z.string().trim().max(80).optional(),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: messageText,
          })
          .strict()
      )
      .max(12)
      .default([]),
  })
  .strict()
  .refine(
    input =>
      input.history.reduce(
        (sum, row) => sum + row.content.length,
        input.text.length
      ) <= 16000
  );

export type ChatMessage = {
  id: number;
  clientId: string;
  sender: "staff" | "visitor" | "assistant";
  name: string | null;
  own: boolean;
  original: string;
  sourceLocale: string;
  createdAt: Date;
  imported: boolean;
  read: boolean;
  translation: {
    text: string | null;
    status: "queued" | "working" | "done" | "failed" | "missing";
    needsReview: boolean;
  } | null;
};

// Only direct, affirmative requests bypass AI. Ambiguous wording is handled by
// the assistant planner; negations must never force a handoff.
export function explicitHumanRequest(text: string) {
  const value = text.toLowerCase().normalize("NFKC").replace(/[أإآ]/g, "ا");
  if (
    /\b(?:not|don't|do not|no|sin|nunca)\b|(?:لا اريد|ما بدي|مابدي|مو بدي|لا تحول|لاتحول)/.test(
      value
    )
  )
    return false;
  return /(?:بدي|اريد|ممكن|حولني|وصلني).{0,45}(?:موظف|انسان|شخص حقيقي|دعم بشري)|(?:speak|talk|connect|transfer).{0,35}(?:human|person|agent|employee)|(?:hablar|comunicar|conectar|pasar).{0,40}(?:persona|agente|empleado|humano)|(?:人工客服|转人工)|(?:कर्मचारी|इंसान).{0,20}(?:बात)/.test(
    value
  );
}
