// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "en",
  profiles: {} as Record<number, any>,
  permissions: ["providers.write", "integrations.read"],
  options: {} as any,
  mutate: vi.fn(),
  invalidate: vi.fn(async () => {}),
  setData: vi.fn(),
}));
vi.mock("../client/src/components/LinkAutofill", () => ({
  default: () => null,
  GroupSourceDetails: () => null,
}));
vi.mock("@/contexts/LocaleContext", async original => ({
  ...(await original<any>()),
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/components/ProviderPicker", () => ({
  default: ({ value, onChange }: any) =>
    React.createElement(
      "select",
      {
        "aria-label": "Provider picker",
        value,
        onChange: (event: any) => onChange(event.target.value),
      },
      ["", "1", "2"].map(id =>
        React.createElement("option", { key: id, value: id }, id || "Choose")
      )
    ),
}));
vi.mock("@/lib/trpc", () => {
  const invalidation = { invalidate: state.invalidate };
  const mutation = {
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  };
  return {
    trpc: {
      useUtils: () => ({
        admin: {
          providers: {
            profile: { ...invalidation, setData: state.setData },
            page: invalidation,
            list: invalidation,
          },
          integrations: { list: invalidation, alerts: invalidation },
          audit: { list: invalidation },
        },
        marketplace: { snapshot: invalidation },
      }),
      admin: {
        access: {
          useQuery: () => ({ data: { permissions: state.permissions } }),
        },
        providers: {
          profile: {
            useQuery: ({ id }: any) => ({
              data: state.profiles[id],
              isLoading: false,
              refetch: async () => ({ data: state.profiles[id] }),
            }),
          },
          saveProfile: {
            useMutation: (options: any) => {
              state.options = options;
              return { mutate: state.mutate, isPending: false };
            },
          },
          createDraft: mutation,
        },
        integrations: {
          list: { useQuery: () => ({ data: [], isLoading: false }) },
          save: mutation,
          syncNow: mutation,
          setEnabled: mutation,
          remove: mutation,
        },
      },
    },
  };
});
import ProviderProfileEditor from "../client/src/components/ProviderProfileEditor";
import ProviderIntegrationVault from "../client/src/components/ProviderIntegrationVault";
import {
  ProviderLogo,
  ProviderWebsitePreview,
} from "../client/src/components/ProviderMedia";

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  state.locale = "en";
  state.permissions = ["providers.write", "integrations.read"];
  state.profiles = Object.fromEntries(
    [1, 2].map(id => [
      id,
      {
        id,
        revision: 1,
        slug: `provider-${id}`,
        isPublic: id === 1,
        name: `Provider ${id}`,
        description: "Public description",
        websiteUrl: "https://provider.example/",
        logoUrl: null,
        websitePreviewUrl: null,
        telegramUrl: null,
      },
    ])
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const render = (
  element = React.createElement(ProviderProfileEditor, {
    providerId: 1,
    key: 1,
  })
) => act(() => root.render(element));
function field(label: string) {
  return Array.from(container.querySelectorAll("label"))
    .find(node => node.querySelector("span")?.textContent === label)!
    .querySelector("input, textarea") as HTMLInputElement;
}
async function enter(label: string, value: string) {
  const input = field(label);
  await act(() => {
    const prototype =
      input.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
      input,
      value
    );
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

describe("provider profile controls", () => {
  it("saves canonical public fields, keeps dirty edits on refetch and refreshes public data", async () => {
    await render();
    await enter("Provider name", "Edited provider");
    await enter("Telegram link or username", "@ProviderSupport");
    state.profiles[1] = { ...state.profiles[1], name: "Background copy" };
    await render();
    expect(field("Provider name").value).toBe("Edited provider");
    await submit();
    expect(state.mutate).toHaveBeenCalledTimes(1);
    const payload = state.mutate.mock.calls[0][0];
    expect(payload).toMatchObject({
      id: 1,
      revision: 1,
      name: "Edited provider",
      telegramUrl: "https://t.me/providersupport",
    });
    expect(Object.keys(payload).sort()).toEqual(
      [
        "id",
        "revision",
        "name",
        "description",
        "websiteUrl",
        "logoUrl",
        "websitePreviewUrl",
        "telegramUrl",
      ].sort()
    );
    await act(async () =>
      state.options.onSuccess({
        ...payload,
        revision: 2,
        slug: "provider-1",
        isPublic: true,
      })
    );
    expect(container.textContent).not.toContain("Unsaved changes");
    expect(state.invalidate).toHaveBeenCalledTimes(5);
    expect(state.setData).toHaveBeenCalledWith(
      { id: 1 },
      expect.objectContaining({ revision: 2 })
    );
  });
  it("does not carry a draft or revision into a different provider", async () => {
    await render();
    await enter("Provider name", "Unfinished first provider");
    await render(
      React.createElement(ProviderProfileEditor, { providerId: 2, key: 2 })
    );
    expect(field("Provider name").value).toBe("Provider 2");
    expect(container.textContent).not.toContain("Open provider page");
    await enter("Provider name", "Second provider edited");
    await submit();
    expect(state.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2,
        revision: 1,
        name: "Second provider edited",
      })
    );
  });
  it("keeps a conflicted draft until the editor reloads the newer saved version", async () => {
    await render();
    await enter("Provider name", "My unsaved edit");
    await submit();
    await act(() => state.options.onError({ data: { code: "CONFLICT" } }));
    expect(field("Provider name").value).toBe("My unsaved edit");
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!
        .disabled
    ).toBe(true);
    state.profiles[1] = {
      ...state.profiles[1],
      revision: 2,
      name: "Saved by colleague",
    };
    const reload = Array.from(container.querySelectorAll("button")).find(
      button => button.textContent === "Reload saved profile"
    )!;
    await act(async () => {
      reload.click();
    });
    expect(field("Provider name").value).toBe("Saved by colleague");
    await enter("Provider name", "Revised edit");
    await submit();
    expect(state.mutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ revision: 2 })
    );
  });
  it("makes identity settings available to provider editors without granting API write controls", async () => {
    await render(React.createElement(ProviderIntegrationVault));
    expect(container.textContent).toContain("Public provider profile");
    expect(container.querySelector('input[type="password"]')).toBeNull();
    state.permissions = ["providers.read", "integrations.read"];
    await render(React.createElement(ProviderIntegrationVault));
    expect(container.textContent).not.toContain("Public provider profile");
  });
  it("blocks malformed URLs and provides Arabic field labels", async () => {
    state.locale = "ar";
    await render();
    expect(container.textContent).toContain("رابط صورة اللوجو");
    expect(container.textContent).toContain("رابط تلجرام أو اسم المستخدم");
    await enter("رابط صورة اللوجو", "https://provider.example/logo?secret=key");
    await submit();
    expect(state.mutate).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "راجع الاسم والروابط"
    );
  });
});

describe("provider public media", () => {
  it("shows a white transparent logo on a dark surface and a dark logo on white", async () => {
    const pixels = new Uint8ClampedArray([255, 255, 255, 255]);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: pixels }),
    } as any);
    await render(
      React.createElement(ProviderLogo, {
        src: "https://providerbeacon.com/logo.png",
        name: "Provider",
        initials: "PB",
      })
    );
    await act(() =>
      container.querySelector("img")!.dispatchEvent(new Event("load"))
    );
    expect(
      container.querySelector("img")!.parentElement!.style.backgroundColor
    ).toBe("rgb(15, 23, 42)");
    pixels.set([0, 0, 0, 255]);
    await render(
      React.createElement(ProviderLogo, {
        src: "https://providerbeacon.com/dark.png",
        name: "Provider",
        initials: "PB",
      })
    );
    await act(() =>
      container.querySelector("img")!.dispatchEvent(new Event("load"))
    );
    expect(
      container.querySelector("img")!.parentElement!.style.backgroundColor
    ).toBe("rgb(255, 255, 255)");
  });
  it("uses the provider initials when an image loads but contains no visible artwork", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) }),
    } as any);
    await render(
      React.createElement(ProviderLogo, {
        src: "https://providerbeacon.com/empty.svg",
        name: "Provider",
        initials: "PB",
      })
    );
    await act(() =>
      container.querySelector("img")!.dispatchEvent(new Event("load"))
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("PB");
  });
  it("falls back to initials for a failed logo and renders a replacement URL", async () => {
    const logo = (src: string) =>
      React.createElement(ProviderLogo, {
        src,
        name: "Provider",
        initials: "PB",
      });
    await render(logo("https://cdn.example.com/logo.png"));
    await act(() =>
      container.querySelector("img")!.dispatchEvent(new Event("error"))
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("PB");
    await render(logo("https://cdn.example.com/logo-new.png"));
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.example.com/logo-new.png"
    );
  });
  it("hides a failed website screenshot without leaving an empty link or frame", async () => {
    await render(
      React.createElement(ProviderWebsitePreview, {
        src: "https://cdn.example.com/preview.png",
        title: "Preview",
        openLabel: "Full image",
      })
    );
    expect(container.querySelector("a")?.getAttribute("rel")).toBe(
      "noopener noreferrer"
    );
    await act(() =>
      container.querySelector("img")!.dispatchEvent(new Event("error"))
    );
    expect(container.innerHTML).toBe("");
  });
});
