import { render, fireEvent, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { CHEATSHEET_OPEN_EVENT, COMMAND_PALETTE_OPEN_EVENT, ShortcutsRoot } from "./shortcuts-root";

const { toastMock, dismissMock } = vi.hoisted(() => ({
  toastMock: vi.fn(() => ({ id: "t1", dismiss: vi.fn(), update: vi.fn() })),
  dismissMock: vi.fn(),
}));

vi.mock("@repo/ui/hooks/use-toast", () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: toastMock, dismiss: dismissMock, toasts: [] }),
  useIsMobile: vi.fn(() => false),
}));

function key(k: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(document.body, { key: k, ...init });
}

beforeEach(() => vi.clearAllMocks());

describe("ShortcutsRoot", () => {
  it("opens the command palette on Ctrl/⌘+K", () => {
    const handler = vi.fn();
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handler);
    render(<ShortcutsRoot locale="en-US" />);
    key("k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handler);
  });

  it("opens the cheatsheet on ?", () => {
    const handler = vi.fn();
    window.addEventListener(CHEATSHEET_OPEN_EVENT, handler);
    render(<ShortcutsRoot locale="en-US" />);
    key("?");
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(CHEATSHEET_OPEN_EVENT, handler);
  });

  it("navigates via g-then-letter (G E → experiments)", () => {
    const { router } = render(<ShortcutsRoot locale="en-US" />);
    key("g");
    key("e");
    expect(router.push).toHaveBeenCalledWith("/en-US/platform/experiments");
  });

  it("g-then-n toggles the notification bell instead of navigating", () => {
    const handler = vi.fn();
    window.addEventListener("openjii:toggle-notification-bell", handler);
    const { router } = render(<ShortcutsRoot locale="en-US" />);
    key("g");
    key("n");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    window.removeEventListener("openjii:toggle-notification-bell", handler);
  });

  it("C creates route-aware (on /platform/experiments → new)", () => {
    const { router } = render(<ShortcutsRoot locale="en-US" />);
    key("c");
    expect(router.push).toHaveBeenCalledWith("/en-US/platform/experiments/new");
  });

  it("/ focuses the page's inline search input", () => {
    render(
      <>
        <input type="search" data-testid="search" />
        <ShortcutsRoot locale="en-US" />
      </>,
    );
    key("/");
    expect(document.activeElement).toBe(document.querySelector('input[type="search"]'));
  });

  it("does not fire single-key shortcuts while typing in an input", () => {
    const { router } = render(
      <>
        <input data-testid="field" />
        <ShortcutsRoot locale="en-US" />
      </>,
    );
    const field = screen.getByTestId("field");
    fireEvent.keyDown(field, { key: "g" });
    fireEvent.keyDown(field, { key: "e" });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows a 'Go to…' toast when entering g-mode", () => {
    render(<ShortcutsRoot locale="en-US" />);
    key("g");
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Go to…" }));
  });
});
