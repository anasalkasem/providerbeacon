// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LinkMetadata } from "../shared/linkMetadata";
const state = vi.hoisted(() => ({
  requests: [] as {
    route: string;
    url: string;
    resolve: (value: unknown) => void;
    reject: (value: unknown) => void;
  }[],
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: "en" }),
}));
vi.mock("@/lib/trpc", () => {
  const route = (name: string) => ({
    useMutation: () => ({
      mutateAsync: ({ url }: { url: string }) =>
        new Promise((resolve, reject) => {
          state.requests.push({ route: name, url, resolve, reject });
        }),
    }),
  });
  return {
    trpc: {
      admin: {
        providers: { previewWebsite: route("website") },
        groups: { previewTelegram: route("staff") },
      },
      community: {
        previewTelegram: route("member"),
        providers: { useQuery: () => ({ data: [] }) },
      },
    },
  };
});
import { GroupForm } from "../client/src/components/CommunityUi";
import ProviderDraftFields from "../client/src/components/ProviderDraftFields";
import LinkAutofill from "../client/src/components/LinkAutofill";

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.requests = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function input(selector: string, value: string) {
  const element = container.querySelector(selector) as HTMLInputElement;
  await act(async () => {
    const prototype =
      element.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
      element,
      value
    );
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
const result = (
  url: string,
  patch: Partial<LinkMetadata> = {}
): LinkMetadata => ({
  key: "a".repeat(64),
  kind: "telegram",
  sourceUrl: url,
  fetchedAt: "2026-09-15T12:00:00.000Z",
  name: "Suggested group name",
  description: "A description retrieved from the Telegram group.",
  avatarUrl: null,
  audience: { count: 1234, kind: "members", approximate: false },
  topic: "learning",
  language: "es",
  aiSuggested: true,
  logoUrl: null,
  websitePreviewUrl: null,
  telegramUrl: null,
  complete: true,
  ...patch,
});
describe("automatic form filling", () => {
  it("fills group fields from a pasted URL while preserving a name edited during the request", async () => {
    const save = vi.fn();
    await act(async () =>
      root.render(
        React.createElement(GroupForm, { onSave: save, pending: false })
      )
    );
    await input('input[type="url"]', "https://t.me/provider_group");
    await tick();
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0].route).toBe("member");
    await input('input[minlength="3"]', "My custom group name");
    await act(async () =>
      state.requests[0].resolve(result(state.requests[0].url))
    );
    expect(
      (container.querySelector('input[minlength="3"]') as HTMLInputElement)
        .value
    ).toBe("My custom group name");
    expect(
      (container.querySelector("textarea") as HTMLTextAreaElement).value
    ).toContain("retrieved from");
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe(
      "learning"
    );
    expect(container.textContent).toContain("1,234 members");
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "My custom group name",
        metadataKey: "a".repeat(64),
        topic: "learning",
        language: "es",
      })
    );
  });
  it("ignores an old response after a URL change and uses the staff endpoint for admin forms", async () => {
    await act(async () =>
      root.render(
        React.createElement(GroupForm, {
          admin: true,
          onSave: vi.fn(),
          pending: false,
        })
      )
    );
    await input('input[type="url"]', "https://t.me/first_group");
    await tick();
    await input('input[type="url"]', "https://t.me/second_group");
    await tick();
    expect(state.requests.map(r => r.route)).toEqual(["staff", "staff"]);
    await act(async () =>
      state.requests[0].resolve(
        result(state.requests[0].url, { name: "Wrong group" })
      )
    );
    expect(
      (container.querySelector('input[minlength="3"]') as HTMLInputElement)
        .value
    ).toBe("");
    expect(container.textContent).not.toContain("Wrong group");
    await act(async () =>
      state.requests[1].resolve(
        result(state.requests[1].url, { name: "Correct group" })
      )
    );
    expect(
      (container.querySelector('input[minlength="3"]') as HTMLInputElement)
        .value
    ).toBe("Correct group");
  });
  it("clears earlier automatic data when switching to a private link that exposes no metadata", async () => {
    await act(async () =>
      root.render(
        React.createElement(GroupForm, { onSave: vi.fn(), pending: false })
      )
    );
    await input('input[type="url"]', "https://t.me/first_group");
    await tick();
    await act(async () =>
      state.requests[0].resolve(result(state.requests[0].url))
    );
    await input('input[type="url"]', "https://t.me/+AbCdefg12345");
    await tick();
    await act(async () =>
      state.requests[1].resolve(
        result(state.requests[1].url, {
          name: null,
          description: null,
          audience: null,
          topic: null,
          language: null,
          complete: false,
          aiSuggested: false,
        })
      )
    );
    expect(
      (container.querySelector('input[minlength="3"]') as HTMLInputElement)
        .value
    ).toBe("");
    expect(
      (container.querySelector("textarea") as HTMLTextAreaElement).value
    ).toBe("");
    expect(container.textContent).not.toContain("1,234");
    expect(
      (container.querySelector('button[type="submit"]') as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
  it("keeps deliberately cleared fields empty and allows manual entry after a request failure", async () => {
    await act(async () =>
      root.render(
        React.createElement(GroupForm, { onSave: vi.fn(), pending: false })
      )
    );
    await input('input[type="url"]', "https://t.me/provider_group");
    await tick();
    await input("textarea", "A manual draft");
    await input("textarea", "");
    await act(async () =>
      state.requests[0].resolve(result(state.requests[0].url))
    );
    expect(
      (container.querySelector("textarea") as HTMLTextAreaElement).value
    ).toBe("");
    await input('input[type="url"]', "https://t.me/other_group");
    await tick();
    await act(async () => state.requests[1].reject(new Error("unavailable")));
    expect(
      (container.querySelector('button[type="submit"]') as HTMLButtonElement)
        .disabled
    ).toBe(false);
    expect(container.textContent).toContain("enter them manually");
  });
  it("submits the provider's source-bound metadata key and never renders a screenshot as a logo", async () => {
    const create = vi.fn();
    await act(async () =>
      root.render(
        React.createElement(ProviderDraftFields, {
          onCreate: create,
          pending: false,
        })
      )
    );
    await input('input[type="url"]', "https://provider.com/");
    await tick();
    await act(async () =>
      state.requests[0].resolve(
        result(state.requests[0].url, {
          kind: "website",
          name: "Provider",
          logoUrl:
            "https://providerbeacon.com/api/imported-media/" + "b".repeat(64),
          websitePreviewUrl:
            "https://providerbeacon.com/api/imported-media/" + "c".repeat(64),
        })
      )
    );
    expect(
      container.querySelector('img[alt="Website logo"]')?.getAttribute("src")
    ).toContain("b".repeat(64));
    expect(
      container
        .querySelector('img[alt="Homepage screenshot"]')
        ?.getAttribute("src")
    ).toContain("c".repeat(64));
    await act(async () =>
      (
        Array.from(container.querySelectorAll("button")).at(
          -1
        ) as HTMLButtonElement
      ).click()
    );
    expect(create).toHaveBeenCalledWith({
      name: "Provider",
      websiteUrl: "https://provider.com/",
      metadataKey: "a".repeat(64),
    });
  });
  it("does not fetch while editing an existing unchanged link until explicitly requested", async () => {
    await act(async () =>
      root.render(
        React.createElement(LinkAutofill, {
          kind: "website",
          url: "https://provider.com",
          automatic: false,
          onResolved: vi.fn(),
        })
      )
    );
    await tick();
    expect(state.requests).toHaveLength(0);
    await act(async () => container.querySelector("button")!.click());
    await tick();
    expect(state.requests).toHaveLength(1);
  });
});
