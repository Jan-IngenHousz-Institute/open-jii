import { act } from "@testing-library/react";
import { vi } from "vitest";

const NARROW_QUERY = "(width < 40rem)";

/** Makes the viewport narrower than Tailwind's `sm` breakpoint, and lets a test cross it. */
export function stubViewport(isNarrow: boolean) {
  let narrow = isNarrow;
  const changes = new EventTarget();

  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    get matches() {
      return query === NARROW_QUERY && narrow;
    },
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      changes.addEventListener(type, listener);
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      changes.removeEventListener(type, listener);
    },
    dispatchEvent: () => false,
  }));

  return {
    resizeTo(next: "narrow" | "wide") {
      narrow = next === "narrow";
      act(() => {
        changes.dispatchEvent(new Event("change"));
      });
    },
  };
}
