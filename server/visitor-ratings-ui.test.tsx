// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  member: null as any,
  own: { rating: null, isOwner: false } as any,
  save: vi.fn(),
  remove: vi.fn(),
  summaryError: false,
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: "ar" }),
}));
vi.mock("@/hooks/useMember", () => ({
  useMember: () => ({ data: { member: state.member } }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      ratings: { invalidate: vi.fn() },
      marketplace: { snapshot: { invalidate: vi.fn() } },
    }),
    ratings: {
      summary: {
        useQuery: () => ({
          data: { rating: null, reviews: 0 },
          isError: state.summaryError,
          refetch: vi.fn(),
        }),
      },
      mine: { useQuery: () => ({ data: state.own, refetch: vi.fn() }) },
      save: { useMutation: () => ({ mutate: state.save }) },
      remove: { useMutation: () => ({ mutate: state.remove }) },
    },
  },
}));
import VisitorRatings from "../client/src/components/VisitorRatings";
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.member = null;
  state.own = { rating: null, isOwner: false };
  state.summaryError = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const render = () =>
  act(async () =>
    root.render(<VisitorRatings providerId={7} slug="real-provider" />)
  );
describe("visitor rating controls", () => {
  it("shows honest empty-state and sign-in/verification gates before any voting controls", async () => {
    await render();
    expect(container.textContent).toContain("لا توجد تقييمات");
    expect(container.textContent).toContain("ليست إثبات شراء");
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    expect(container.querySelector("a")?.href).toContain("sign-in?next=");
    state.member = { id: 12, emailVerified: false };
    await render();
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/verify-email"
    );
  });
  it("lets a verified visitor pick accessible stars, update and remove their existing vote", async () => {
    state.member = { id: 12, emailVerified: true };
    state.own.rating = { stars: 2, revision: 3 };
    await render();
    const stars = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]'
    );
    expect(stars).toHaveLength(5);
    expect(stars[1].checked).toBe(true);
    await act(async () => stars[3].click());
    const buttons = Array.from(container.querySelectorAll("button"));
    await act(async () =>
      buttons.find(b => b.textContent === "حفظ التقييم")!.click()
    );
    expect(state.save).toHaveBeenCalledWith({
      providerId: 7,
      accountId: 12,
      revision: 3,
      stars: 4,
    });
    await act(async () =>
      buttons.find(b => b.textContent === "حذف تقييمي")!.click()
    );
    expect(state.remove).toHaveBeenCalledWith({
      providerId: 7,
      accountId: 12,
      revision: 3,
    });
  });
  it("does not present zero reviews as a successful load when retrieval fails, and prevents owner self-voting", async () => {
    state.summaryError = true;
    state.member = { id: 12, emailVerified: true };
    state.own.isOwner = true;
    await render();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain("لا توجد تقييمات");
    expect(container.textContent).toContain("لا يمكن للمالك");
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(0);
  });
});
