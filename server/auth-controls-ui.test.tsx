// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  staff: null as any,
  member: null as any,
  navigate: vi.fn(),
  signIn: vi.fn(),
  disable: vi.fn(),
  signInOptions: null as any,
  disableOptions: null as any,
  utils: {
    auth: { me: { invalidate: vi.fn() } },
    member: { me: { invalidate: vi.fn() } },
    workspace: { invalidate: vi.fn() },
  },
}));
vi.mock("@/contexts/LocaleContext", async original => ({
  ...(await original<any>()),
  useLocale: () => ({ locale: "ar", setLocale: vi.fn() }),
}));
vi.mock("wouter", async original => ({
  ...(await original<any>()),
  useLocation: () => ["/sign-in", state.navigate],
}));
vi.mock("@/components/CatalogueState", () => ({ CatalogueNotice: () => null }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => state.utils,
    auth: {
      me: { useQuery: () => ({ data: state.staff }) },
      signIn: {
        useMutation: (options: any) => {
          state.signInOptions = options;
          return { mutate: state.signIn, isPending: false };
        },
      },
      login: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      verifyMfa: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      security: {
        disableMfa: {
          useMutation: (options: any) => {
            state.disableOptions = options;
            return { mutate: state.disable, isPending: false };
          },
        },
      },
    },
    member: {
      me: {
        useQuery: () => ({
          data: {
            member: state.member,
            googleEnabled: true,
            emailEnabled: true,
          },
        }),
      },
      register: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      beginGoogle: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));
import { SiteHeader } from "../client/src/components/SiteChrome";
import { MemberSignIn } from "../client/src/pages/MemberAuth";
import Login from "../client/src/pages/Login";
import { DisableMfa } from "../client/src/components/DisableMfa";
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.staff = null;
  state.member = null;
  window.history.replaceState(null, "", "/sign-in");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
});
async function fill(input: HTMLInputElement, value: string) {
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(() =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  );
}

describe("recognizing staff from the public website", () => {
  it("shows the control center for an active staff session on desktop and mobile", async () => {
    state.staff = { id: 7, authMode: "staff" };
    state.member = { id: 3 };
    await act(() => root.render(<SiteHeader />));
    expect(container.querySelector('a[href="/admin"]')?.textContent).toContain(
      "مركز التحكم"
    );
    expect(container.querySelector('a[href="/sign-in"]')).toBeNull();
    await act(() =>
      (
        container.querySelector("button[aria-label]") as HTMLButtonElement
      ).click()
    );
    expect(container.querySelectorAll('a[href="/admin"]')).toHaveLength(2);
  });
  it("routes members to their workspace and anonymous visitors to sign-in", async () => {
    await act(() => root.render(<SiteHeader />));
    expect(container.querySelector('a[href="/sign-in"]')).not.toBeNull();
    state.member = { id: 3 };
    await act(() => root.render(<SiteHeader />));
    expect(container.querySelector('a[href="/account"]')).not.toBeNull();
    expect(container.querySelector('a[href="/admin"]')).toBeNull();
  });
  it("submits the public password form to shared sign-in and continues pending MFA", async () => {
    await act(() => root.render(<MemberSignIn />));
    await fill(
      container.querySelector('input[type="email"]')!,
      "owner@example.com"
    );
    await fill(
      container.querySelector('input[type="password"]')!,
      "existing staff password"
    );
    await submit();
    expect(state.signIn).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "existing staff password",
    });
    await act(() =>
      state.signInOptions.onSuccess({ kind: "staff", mfaRequired: true })
    );
    expect(state.navigate).toHaveBeenCalledWith("/login?mfa=1", {
      replace: true,
    });
    expect(
      (container.querySelector('input[type="password"]') as HTMLInputElement)
        .value
    ).toBe("");
  });
  it("offers MFA verification without asking for the password again after the handoff", async () => {
    window.history.replaceState(null, "", "/login?mfa=1");
    await act(() => root.render(<Login />));
    expect(
      container.querySelector('input[autocomplete="one-time-code"]')
    ).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });
});

describe("authenticator disable control", () => {
  it("requires opening the form and submitting both proofs before disabling", async () => {
    const onDisabled = vi.fn();
    await act(() => root.render(<DisableMfa onDisabled={onDisabled} />));
    expect(container.textContent).toContain("إيقاف تطبيق المصادقة");
    await act(() =>
      (container.querySelector("button") as HTMLButtonElement).click()
    );
    expect(state.disable).not.toHaveBeenCalled();
    const confirm = container.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await fill(
      container.querySelector('input[type="password"]')!,
      "current staff password"
    );
    await fill(
      container.querySelector('input[autocomplete="one-time-code"]')!,
      "A1B2-C3D4-E5F6"
    );
    expect(confirm.disabled).toBe(false);
    await submit();
    expect(state.disable).toHaveBeenCalledWith({
      currentPassword: "current staff password",
      code: "A1B2-C3D4-E5F6",
      confirm: true,
    });
    await act(() =>
      state.disableOptions.onError({ message: "auth_mfa_invalid_proof" })
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "تحقق من كلمة المرور"
    );
    expect(onDisabled).not.toHaveBeenCalled();
    await act(() => state.disableOptions.onSuccess());
    expect(onDisabled).toHaveBeenCalledOnce();
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });
  it("cancels without changing the account or retaining entered credentials", async () => {
    await act(() => root.render(<DisableMfa onDisabled={vi.fn()} />));
    await act(() =>
      (container.querySelector("button") as HTMLButtonElement).click()
    );
    await fill(
      container.querySelector('input[type="password"]')!,
      "cancelled password"
    );
    await act(() =>
      Array.from(container.querySelectorAll("button"))
        .find(b => b.textContent === "إلغاء")!
        .click()
    );
    expect(state.disable).not.toHaveBeenCalled();
    await act(() =>
      (container.querySelector("button") as HTMLButtonElement).click()
    );
    expect(
      (container.querySelector('input[type="password"]') as HTMLInputElement)
        .value
    ).toBe("");
  });
});
