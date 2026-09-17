// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  locale: "es",
  thread: null as any,
  send: vi.fn(),
  read: vi.fn(),
  prepare: vi.fn(),
  handoff: vi.fn(),
  assistantReady: false,
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({
    locale: state.locale,
    dir: state.locale === "ar" ? "rtl" : "ltr",
  }),
  localeNames: {
    ar: "العربية",
    es: "Español",
    en: "English",
    hi: "हिन्दी",
    zh: "简体中文",
  },
}));
vi.mock("@/lib/trpc", () => {
  const mutation = (fn: any) => ({
    mutateAsync: fn,
    mutate: (input: any, options: any) => {
      const result = fn(input);
      if (result && typeof result.then === "function")
        result.then(options?.onSuccess, options?.onError);
      else options?.onSuccess?.(result);
    },
    isPending: false,
  });
  const api = {
    thread: {
      useQuery: () => ({
        data: state.thread,
        refetch: vi.fn(),
        isLoading: false,
      }),
    },
    send: { useMutation: () => mutation(state.send) },
    read: { useMutation: () => mutation(state.read) },
    prepare: { useMutation: () => mutation(state.prepare) },
    close: { useMutation: () => mutation(vi.fn()) },
  };
  return {
    trpc: {
      useUtils: () => ({ messaging: { list: { invalidate: vi.fn() } } }),
      messaging: {
        ...api,
        assign: { useMutation: () => mutation(vi.fn()) },
        support: {
          ...api,
          current: { useQuery: () => ({ data: null, refetch: vi.fn() }) },
          start: { useMutation: () => mutation(state.handoff) },
          language: { useMutation: () => mutation(vi.fn()) },
        },
      },
      assistant: {
        status: {
          useQuery: () => ({
            data: { available: state.assistantReady },
            isLoading: false,
          }),
        },
        chat: { useMutation: () => mutation(vi.fn()) },
      },
    },
  };
});
import MessageThread, {
  MessageBubble,
} from "../client/src/components/MessageThread";
import BeaconAssistant from "../client/src/components/BeaconAssistant";
let container: HTMLDivElement, root: Root;
const message = () => ({
  id: 1,
  clientId: "test",
  sender: "staff" as const,
  name: "زميل",
  own: false,
  original: "مرحبا",
  sourceLocale: "ar",
  createdAt: new Date(),
  imported: false,
  read: false,
  translation: { text: "Hola", status: "done" as const, needsReview: false },
});
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.locale = "es";
  state.assistantReady = false;
  state.thread = {
    id: "6ca0f338-51be-47dd-ae53-7c11207d7a2f",
    kind: "direct",
    status: "assigned",
    locale: "es",
    assignedUserId: null,
    name: "زميل",
    items: [message()],
    nextCursor: null,
    lastMessageId: 1,
  };
  state.send.mockReset();
  state.send.mockResolvedValue({ id: 2 });
  state.handoff.mockReset();
  state.handoff.mockResolvedValue({ id: state.thread.id });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  window.history.replaceState({}, "", "/");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});
const click = async (text: string) => {
  const button = Array.from(container.querySelectorAll("button")).find(b =>
    b.textContent?.includes(text)
  );
  expect(button).toBeTruthy();
  await act(async () => button!.click());
};
describe("translated messenger", () => {
  it("shows the recipient translation first and reveals the unchanged original on request", async () => {
    await act(async () =>
      root.render(
        <MessageBubble message={message()} locale="es" onRetry={vi.fn()} />
      )
    );
    expect(container.textContent).toContain("Hola");
    expect(container.textContent).not.toContain("مرحبا");
    await click("Ver original");
    expect(container.textContent).toContain("مرحبا");
    expect(container.textContent).not.toContain("Hola");
    await click("Ocultar original");
    expect(container.textContent).toContain("Hola");
  });
  it("keeps the original readable after translation failure and offers a deliberate retry", async () => {
    const retry = vi.fn();
    await act(async () =>
      root.render(
        <MessageBubble
          message={{
            ...message(),
            translation: { text: null, status: "failed", needsReview: false },
          }}
          locale="ar"
          onRetry={retry}
        />
      )
    );
    expect(container.textContent).toContain("مرحبا");
    expect(container.textContent).toContain("الترجمة غير متاحة");
    await click("إعادة المحاولة");
    expect(retry).toHaveBeenCalledOnce();
  });
  it("does not mark messages read while the page is hidden", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () =>
      root.render(
        <MessageThread
          id={state.thread.id}
          mode="staff"
          userId={5}
          onBack={vi.fn()}
        />
      )
    );
    expect(state.read).not.toHaveBeenCalled();
    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(state.read).toHaveBeenCalledWith({
      conversationId: state.thread.id,
      messageId: 1,
    });
  });
  it("allows customer handoff even when the AI catalogue assistant is unavailable", async () => {
    state.locale = "ar";
    await act(async () => root.render(<BeaconAssistant />));
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toContain("تحدث مع موظف");
    expect(container.textContent).toContain("يُشارك سجل المساعد");
    state.thread = {
      ...state.thread,
      kind: "support",
      status: "waiting",
      items: [],
      lastMessageId: 0,
      locale: "ar",
    };
    await click("تحدث مع موظف");
    expect(state.handoff).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "ar",
        text: "أريد التحدث مع أحد الموظفين.",
        history: [],
      })
    );
    expect(container.textContent).toContain("بانتظار موظف متاح");
    expect(container.textContent).not.toContain("تتحدث مع");
  });
});
