import { describe, expect, it } from "vitest";
import {
  rotateVipCards,
  VIP_PAGE_SIZE,
  vipSaveInput,
  vipEventInput,
} from "../shared/providerVip";
import { decodeVipCover } from "./providerVipDb";

export const vipTestCover =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK2sAAAAASUVORK5CYII=";
describe("VIP album inputs and rotation", () => {
  it("gives every card every position and stable, non-overlapping pages", () => {
    const ids = Array.from({ length: 13 }, (_, i) => i + 1);
    const exposures = new Map<number, number>();
    for (let slot = 0; slot < ids.length; slot++) {
      const rotated = rotateVipCards(ids, slot);
      expect(new Set(rotated).size).toBe(ids.length);
      const first = rotated.slice(0, VIP_PAGE_SIZE),
        second = rotated.slice(VIP_PAGE_SIZE);
      expect([...first, ...second].sort((a, b) => a - b)).toEqual(ids);
      for (const id of first) exposures.set(id, (exposures.get(id) ?? 0) + 1);
    }
    expect([...exposures.values()]).toEqual(Array(13).fill(VIP_PAGE_SIZE));
    expect(rotateVipCards([], 42)).toEqual([]);
    expect(rotateVipCards([1], 42)).toEqual([1]);
  });
  it("rejects active content and mismatched file types without fetching external URLs", () => {
    expect(decodeVipCover(vipTestCover).mime).toBe("image/png");
    for (const cover of [
      "https://external.example/a.jpg",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      vipTestCover.replace("image/png", "image/jpeg"),
      "data:image/png;base64,PGh0bWw+ZXZpbDwvaHRtbD4=",
    ])
      expect(() => decodeVipCover(cover)).toThrow("business_vip_cover");
  });
  it("requires concise content and a future end date for offers; forbids client approval and foreign IDs", () => {
    const value = {
      providerId: 1,
      revision: 0,
      tagline: "Provider with clear service terms",
      specialties: ["Telegram"],
      offer: "",
      offerEndsAt: null,
    };
    expect(vipSaveInput.safeParse(value).success).toBe(true);
    for (const patch of [
      { status: "approved" },
      { ownerMemberId: 9 },
      { specialties: ["Telegram", "telegram"] },
      { tagline: "x".repeat(141) },
      { offer: "Save today" },
      { offer: "Save", offerEndsAt: new Date(0) },
      { cover: "x".repeat(800000) },
    ])
      expect(vipSaveInput.safeParse({ ...value, ...patch }).success).toBe(
        false
      );
    expect(
      vipEventInput.safeParse({
        providerId: 1,
        revision: 2,
        kind: "click",
        visitorId: "bad",
      }).success
    ).toBe(false);
  });
});
