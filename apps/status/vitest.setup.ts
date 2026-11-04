import { notifyManager } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

// next-themes reads the system scheme through matchMedia, which jsdom lacks.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// jsdom has no Web Animations, which the intake bubbles and the leaf flash call.
Object.defineProperty(Element.prototype, "animate", {
  configurable: true,
  writable: true,
  value: () => ({ onfinish: null, cancel: () => undefined }),
});

// TanStack Query hands results to components on a zero-delay timer, which fake timers hold back
// past the end of an advance. A microtask hands them over inside the act() each test awaits.
notifyManager.setScheduler(queueMicrotask);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
