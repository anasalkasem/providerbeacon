// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MobileDisclosure } from "../client/src/components/MobileDisclosure";

it("opens and closes through an accessible button without losing filter values", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <MobileDisclosure label="Filters">
          <label>
            Quantity
            <input defaultValue="1000" />
          </label>
        </MobileDisclosure>
      )
    );
    const button = host.querySelector("button")!;
    const field = host.querySelector("input")!;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(
      document
        .getElementById(button.getAttribute("aria-controls")!)
        ?.contains(field)
    ).toBe(true);
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    field.value = "5000";
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await act(async () => button.click());
    expect(field.value).toBe("5000");
    expect(host.querySelectorAll("input")).toHaveLength(1);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
