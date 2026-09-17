import { describe, it, expect, vi } from "vitest";
import {
  explicitHumanRequest,
  handoffInput,
  sendMessageInput,
} from "../shared/messaging";
import {
  protectMessage,
  restoreMessage,
  translateMessage,
  translationInstructions,
} from "./messageTranslation";
import { runAssistantTurn } from "./assistant";

describe("professional message translation", () => {
  it("translates intent with context and never exposes protected amounts or links to rewriting", async () => {
    const model = vi.fn(async (_name, _schema, instructions, input) => {
      expect(instructions).toBe(translationInstructions);
      const request = JSON.parse(input);
      expect(request.targetLanguage).toBe("Spanish (Latin America)");
      expect(request.context).toEqual([
        { sender: "visitor", text: "Can I get a refund?" },
      ]);
      expect(request.message).not.toContain("19.25");
      const tokens = request.message.match(/⟪PB:[^⟫]*⟫/g);
      return {
        text: `No prometas un reembolso de ${tokens[0]} ${tokens[1]}. Consulta ${tokens[2]}.`,
        sourceLocale: "ar",
        needsReview: false,
      };
    });
    const result = await translateMessage(
      {
        text: "لا تعده باسترداد 19.25 USDT. راجع https://example.com/order/501",
        sourceLocale: "ar",
        targetLocale: "es",
        context: [{ sender: "visitor", text: "Can I get a refund?" }],
      },
      model as any
    );
    expect(result.text).toBe(
      "No prometas un reembolso de 19.25 USDT. Consulta https://example.com/order/501."
    );
    expect(model).toHaveBeenCalledTimes(1);
  });
  it("handles the requested Arabic-to-Spanish greeting", async () => {
    const model = vi.fn(async () => ({
      text: "Hola",
      sourceLocale: "ar",
      needsReview: false,
    }));
    expect(
      await translateMessage(
        { text: "مرحبا", sourceLocale: "en", targetLocale: "es", context: [] },
        model as any
      )
    ).toEqual({ text: "Hola", sourceLocale: "ar", needsReview: false });
  });
  it("rejects changed, dropped, duplicated or invented protected data", () => {
    const protectedValue = protectMessage(
      "PayPal USD 19.25 order INV-1234 email a@example.com الرابط https://example.com/1 والكمية ٥٠٠٠"
    );
    expect(restoreMessage(protectedValue.text, protectedValue.tokens)).toBe(
      "PayPal USD 19.25 order INV-1234 email a@example.com الرابط https://example.com/1 والكمية ٥٠٠٠"
    );
    const token = Array.from(protectedValue.tokens.keys())[0];
    expect(() =>
      restoreMessage(
        protectedValue.text.replace(token, "Stripe"),
        protectedValue.tokens
      )
    ).toThrow();
    expect(() =>
      restoreMessage(protectedValue.text + token, protectedValue.tokens)
    ).toThrow();
    expect(() =>
      restoreMessage(protectedValue.text + " plus 50%", protectedValue.tokens)
    ).toThrow();
    expect(() =>
      restoreMessage(
        protectedValue.text + " ⟪PB:fake:0⟫",
        protectedValue.tokens
      )
    ).toThrow();
  });
  it("treats placeholder-looking user text as literal data", () => {
    const value = "احتفظ بالنص ⟪PB:fake:0⟫ 29.50";
    const protectedValue = protectMessage(value);
    expect(restoreMessage(protectedValue.text, protectedValue.tokens)).toBe(
      value
    );
  });
  it("bounds messages and handoff transcripts before paid processing", () => {
    expect(
      sendMessageInput.safeParse({
        conversationId: crypto.randomUUID(),
        clientId: crypto.randomUUID(),
        locale: "ar",
        text: "x".repeat(2001),
      }).success
    ).toBe(false);
    expect(
      handoffInput.safeParse({
        clientId: crypto.randomUUID(),
        locale: "es",
        text: "Hi",
        history: Array.from({ length: 12 }, () => ({
          role: "user",
          content: "x".repeat(2000),
        })),
      }).success
    ).toBe(false);
  });
});
describe("human handoff", () => {
  it.each([
    "بدي احكي مع موظف",
    "أريد التحدث مع إنسان",
    "Please connect me to a human agent",
    "Quiero hablar con una persona",
    "转人工客服",
  ])("recognizes an explicit request: %s", text =>
    expect(explicitHumanRequest(text)).toBe(true)
  );
  it.each([
    "ما بدي موظف",
    "لا أريد موظف",
    "I don't want to talk to a human",
    "No quiero hablar con una persona",
    "ما هي سياسة دعم المزود؟",
  ])("does not force a declined/unrelated handoff: %s", text =>
    expect(explicitHumanRequest(text)).toBe(false)
  );
  it("stops catalogue search when the planner identifies a human request", async () => {
    const search = vi.fn(),
      byIds = vi.fn(),
      exchange = vi.fn();
    const model = vi.fn(async () => ({
      action: "handoff",
      market: "smm",
      platform: null,
      category: null,
      query: "",
      provider: null,
      countryCode: null,
      quantity: null,
      displayCurrency: null,
      budget: null,
      refillOnly: false,
      minRefillDays: null,
      preferLowest: false,
      serviceIds: [],
      reply: "سنطلب موظفًا لمتابعة الحديث.",
    }));
    const result = await runAssistantTurn(
      {
        message: "بدي حدا يساعدني من فريقكم",
        locale: "ar",
        history: [],
        context: { path: "/", offerIds: [] },
      },
      { model, search, byIds, exchange } as any
    );
    expect(result).toMatchObject({
      handoff: true,
      offers: [],
      totalMatches: 0,
    });
    expect(search).not.toHaveBeenCalled();
    expect(exchange).not.toHaveBeenCalled();
    expect(model).toHaveBeenCalledTimes(1);
  });
});
