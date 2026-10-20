import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePrefersReducedMotion } from "../use-prefers-reduced-motion";

function Probe() {
  return <span data-testid="probe">{String(usePrefersReducedMotion())}</span>;
}

/** A media query whose answer the test changes, telling its listeners as a browser would. */
function systemSetting(initial: boolean) {
  const setting = { matches: initial };
  const addEventListener = vi.fn();

  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: setting.matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener,
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  return (matches: boolean) => {
    setting.matches = matches;
    addEventListener.mock.calls.forEach(([, listener]) => listener());
  };
}

describe("usePrefersReducedMotion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("follows the reader's setting as they change it", () => {
    const change = systemSetting(false);
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("false");

    act(() => change(true));

    expect(screen.getByTestId("probe")).toHaveTextContent("true");
  });

  it("hydrates as the server rendered it, with motion, then follows the reader", () => {
    systemSetting(true);
    const container = document.createElement("div");
    container.innerHTML = '<span data-testid="probe">false</span>';
    document.body.appendChild(container);
    const consoleError = vi.spyOn(console, "error");

    render(<Probe />, { container, hydrate: true });

    expect(screen.getByTestId("probe")).toHaveTextContent("true");
    expect(consoleError).not.toHaveBeenCalled();
  });
});
