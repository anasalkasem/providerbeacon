// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const notices = vi.hoisted(() => ({ show: vi.fn(), dismiss: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(notices.show, { dismiss: notices.dismiss }),
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: "en", dir: "ltr" }),
}));
import {
  createMessageAlertTracker,
  claimMessageAlerts,
  createMessageChime,
  MESSAGE_CHIME_URL,
} from "../client/src/lib/messageAlerts";
import { useMessageAlerts } from "../client/src/hooks/useMessageAlerts";
import MessageAlertControls, {
  UnreadMessages,
} from "../client/src/components/MessageAlertControls";
import type { MessageNotificationSnapshot } from "../shared/messaging";

const item = (messageId: number, conversationId = "conversation-a") => ({
  conversationId,
  kind: "direct" as const,
  messageId,
  name: "Customer name",
});
const snapshot = (...ids: number[]): MessageNotificationSnapshot => ({
  unread: ids.length,
  items: ids.map(id => item(id)),
});
let container: HTMLDivElement, root: Root;
let audio: any, fetchClip: ReturnType<typeof vi.fn>;
function mockAudio() {
  audio = {
    state: "suspended",
    currentTime: 0,
    destination: {},
    onstatechange: null,
    resume: vi.fn(async () => {
      audio.state = "running";
      audio.onstatechange?.();
    }),
    close: vi.fn(async () => {
      audio.state = "closed";
    }),
    decodeAudioData: vi.fn(async () => ({ duration: 1.2 })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      loop: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createOscillator: vi.fn(() => ({
      type: "",
      frequency: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createGain: vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
  };
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function () {
      return audio;
    })
  );
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  vi.clearAllMocks();
  mockAudio();
  fetchClip = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  }));
  vi.stubGlobal("fetch", fetchClip);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("message notifications", () => {
  it("does not replay old, read, reordered or already displayed messages", () => {
    const track = createMessageAlertTracker();
    expect(track(snapshot(10), null)).toEqual([]);
    expect(track(snapshot(11), null)).toEqual([item(11)]);
    expect(track(snapshot(11), null)).toEqual([]);
    expect(track(snapshot(), null)).toEqual([]);
    expect(track(snapshot(10), null)).toEqual([]);
    expect(track(snapshot(12), "conversation-a")).toEqual([]);
    expect(track(snapshot(12), null)).toEqual([]);
    expect(
      track({ unread: 2, items: [item(13), item(14, "conversation-b")] }, null)
    ).toHaveLength(2);
    expect(
      track({ unread: 1, items: [item(9, "older-unread")] }, null)
    ).toEqual([]);
  });
  it("coordinates duplicate alerts across tabs and stores no message names or text", async () => {
    const results = await Promise.all([
      claimMessageAlerts("staff:1", [item(7)]),
      claimMessageAlerts("staff:1", [item(7)]),
    ]);
    expect(results.flat()).toEqual([item(7)]);
    expect(localStorage.getItem("pb-message-alerts:staff:1")).not.toContain(
      "Customer name"
    );
    expect(await claimMessageAlerts("staff:2", [item(7)])).toHaveLength(1);
    expect(await claimMessageAlerts("staff:1", [item(8)])).toHaveLength(1);
  });
  it("keeps alerts usable if browser storage is denied", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(await claimMessageAlerts("staff:1", [item(4)])).toHaveLength(1);
  });
  it("loads the chime only on activation, reuses decoded audio, prevents overlaps and releases resources", async () => {
    const changed = vi.fn();
    const chime = createMessageChime(changed);
    expect(chime.play()).toBe(false);
    expect(fetchClip).not.toHaveBeenCalled();
    expect(await chime.unlock()).toBe(true);
    expect(chime.play()).toBe(true);
    expect(audio.resume).toHaveBeenCalledOnce();
    expect(fetchClip).toHaveBeenCalledOnce();
    expect(fetchClip.mock.calls[0][0]).toBe(MESSAGE_CHIME_URL);
    expect(audio.createBufferSource).toHaveBeenCalledOnce();
    expect(chime.play()).toBe(false);
    const first = audio.createBufferSource.mock.results[0].value;
    expect(first.loop).toBe(false);
    expect(first.stop).toHaveBeenCalledWith(1.2);
    first.onended();
    expect(first.disconnect).toHaveBeenCalledOnce();
    audio.currentTime = 2;
    expect(await chime.unlock()).toBe(true);
    expect(chime.play()).toBe(true);
    expect(fetchClip).toHaveBeenCalledOnce();
    expect(audio.decodeAudioData).toHaveBeenCalledOnce();
    const second = audio.createBufferSource.mock.results[1].value;
    chime.dispose();
    expect(second.disconnect).toHaveBeenCalledOnce();
    expect(audio.close).toHaveBeenCalledOnce();
    expect(chime.play()).toBe(false);
  });
  it("keeps a finite, softer fallback when the sound file cannot load", async () => {
    fetchClip.mockRejectedValueOnce(new TypeError("Offline"));
    const chime = createMessageChime(vi.fn());
    expect(await chime.unlock()).toBe(true);
    expect(chime.play()).toBe(true);
    expect(audio.createBufferSource).not.toHaveBeenCalled();
    expect(audio.createOscillator).toHaveBeenCalledTimes(3);
    for (const result of audio.createOscillator.mock.results) {
      expect(result.value.stop).toHaveBeenCalledOnce();
      expect(result.value.stop.mock.calls[0][0]).toBeLessThan(1);
    }
    chime.stop();
    for (const result of audio.createOscillator.mock.results)
      expect(result.value.disconnect).toHaveBeenCalledOnce();
    chime.dispose();
  });
  it("aborts a stalled download and still activates the local fallback", async () => {
    vi.useFakeTimers();
    fetchClip.mockImplementationOnce(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal!.addEventListener("abort", () =>
            reject(new Error("aborted"))
          );
        })
    );
    const chime = createMessageChime(vi.fn());
    const ready = chime.unlock();
    await vi.advanceTimersByTimeAsync(1600);
    expect(await ready).toBe(true);
    expect(chime.play()).toBe(true);
    chime.dispose();
  });

  const open = vi.fn();
  function Harness({
    data,
    readingId = null,
    scope = "staff:1",
  }: {
    data?: MessageNotificationSnapshot;
    readingId?: string | null;
    scope?: string;
  }) {
    const alerts = useMessageAlerts({
      scope,
      data,
      readingId,
      locale: "en",
      onOpen: open,
    });
    return (
      <>
        <MessageAlertControls alerts={alerts} />
        <UnreadMessages count={data?.unread ?? 0} />
      </>
    );
  }
  const press = async (label: string) => {
    const button = Array.from(container.querySelectorAll("button")).find(
      button => button.textContent === label
    );
    expect(button).toBeTruthy();
    await act(async () => button!.click());
  };
  it("shows incoming banners and a badge, enables sound by click and respects mute", async () => {
    await act(async () => root.render(<Harness data={snapshot(1)} />));
    expect(notices.show).not.toHaveBeenCalled();
    expect(
      container.querySelector('[role="status"]')?.getAttribute("aria-label")
    ).toBe("Unread messages: 1");
    await press("Enable sound");
    expect(audio.createBufferSource).toHaveBeenCalledOnce();
    expect(localStorage.getItem("pb-message-sound:staff:1")).toBe("on");
    audio.currentTime = 2;
    await act(async () => root.render(<Harness data={snapshot(2)} />));
    expect(notices.show).toHaveBeenCalledOnce();
    expect(audio.createBufferSource).toHaveBeenCalledTimes(2);
    notices.show.mock.calls[0][1].action.onClick();
    expect(open).toHaveBeenCalledWith("conversation-a");
    await press("Mute sound");
    expect(
      audio.createBufferSource.mock.results[1].value.disconnect
    ).toHaveBeenCalledOnce();
    await act(async () => root.render(<Harness data={snapshot(3)} />));
    expect(notices.show).toHaveBeenCalledTimes(2);
    expect(audio.createBufferSource).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("pb-message-sound:staff:1")).toBe("off");
  });
  it("suppresses alerts in a thread being read, and silences the first snapshot after an account switch", async () => {
    await act(async () => root.render(<Harness data={snapshot(1)} />));
    await act(async () =>
      root.render(<Harness data={snapshot(2)} readingId="conversation-a" />)
    );
    expect(notices.show).not.toHaveBeenCalled();
    await act(async () => root.render(<Harness data={snapshot(2)} />));
    expect(notices.show).not.toHaveBeenCalled();
    await act(async () =>
      root.render(<Harness scope="staff:2" data={snapshot(20)} />)
    );
    expect(notices.show).not.toHaveBeenCalled();
    await act(async () =>
      root.render(<Harness scope="staff:2" data={snapshot(21)} />)
    );
    expect(notices.show).toHaveBeenCalledOnce();
    await act(async () => root.render(<Harness scope="staff:2" />));
    expect(notices.dismiss).toHaveBeenCalledWith("message-alert:staff:2");
  });
  it("reports blocked audio honestly without disabling visual alerts", async () => {
    audio.resume.mockRejectedValue(new Error("NotAllowedError"));
    await act(async () => root.render(<Harness data={snapshot()} />));
    await press("Enable sound");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Sound could not start"
    );
    expect(localStorage.getItem("pb-message-sound:staff:1")).toBeNull();
    await act(async () => root.render(<Harness data={snapshot(1)} />));
    expect(notices.show).toHaveBeenCalledOnce();
    expect(audio.createOscillator).not.toHaveBeenCalled();
    expect(audio.createBufferSource).not.toHaveBeenCalled();
    expect(fetchClip).not.toHaveBeenCalled();
  });
  it("does not re-enable sound when mute is pressed during a pending preview", async () => {
    localStorage.setItem("pb-message-sound:staff:1", "on");
    let finish: (value: { duration: number }) => void;
    audio.decodeAudioData.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      })
    );
    await act(async () => root.render(<Harness data={snapshot()} />));
    await press("Enable sound");
    await press("Mute sound");
    await act(async () => finish!({ duration: 1.2 }));
    expect(localStorage.getItem("pb-message-sound:staff:1")).toBe("off");
    expect(container.textContent).toContain("Enable sound");
    expect(audio.createBufferSource).not.toHaveBeenCalled();
  });
  it("reactivates a saved sound preference without the pointer gesture accidentally muting it", async () => {
    localStorage.setItem("pb-message-sound:staff:1", "on");
    await act(async () => root.render(<Harness data={snapshot()} />));
    const button = container.querySelector("[data-message-sound-control]")!;
    await act(async () =>
      button.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    );
    expect(audio.resume).not.toHaveBeenCalled();
    await press("Enable sound");
    expect(container.textContent).toContain("Mute sound");
    expect(localStorage.getItem("pb-message-sound:staff:1")).toBe("on");
  });
});
