import { NOTIFICATION_BELL_OPEN_EVENT } from "@/components/navigation/navigation-topbar/activity-popover";
import { render, fireEvent, screen } from "@/test/test-utils";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SidebarProvider } from "@repo/ui/components/sidebar";

import { ShortcutHint } from "./shortcut-hint";
import { CHEATSHEET_OPEN_EVENT, COMMAND_PALETTE_OPEN_EVENT, ShortcutsRoot } from "./shortcuts-root";

// ShortcutsRoot reads useSidebar(), so it must render inside a SidebarProvider.
function renderShortcuts(extra?: ReactNode) {
  return render(
    <SidebarProvider>
      {extra}
      <ShortcutsRoot locale="en-US" />
    </SidebarProvider>,
  );
}

function key(k: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(document.body, { key: k, ...init });
}

beforeEach(() => vi.clearAllMocks());

describe("ShortcutsRoot", () => {
  it("opens the command palette on Ctrl/⌘+K", () => {
    const handler = vi.fn();
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handler);
    renderShortcuts();
    key("k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handler);
  });

  it("opens the cheatsheet on ? (Shift+/)", () => {
    const handler = vi.fn();
    window.addEventListener(CHEATSHEET_OPEN_EVENT, handler);
    renderShortcuts();
    key("?", { shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(CHEATSHEET_OPEN_EVENT, handler);
  });

  it("navigates via g-then-letter (G E -> experiments)", () => {
    const { router } = renderShortcuts();
    key("g");
    key("e");
    expect(router.push).toHaveBeenCalledWith("/en-US/platform/experiments");
  });

  it("g-then-n opens the notification bell instead of navigating", () => {
    const handler = vi.fn();
    window.addEventListener(NOTIFICATION_BELL_OPEN_EVENT, handler);
    const { router } = renderShortcuts();
    key("g");
    key("n");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    window.removeEventListener(NOTIFICATION_BELL_OPEN_EVENT, handler);
  });

  it("C creates route-aware (on /platform/experiments -> new)", () => {
    const { router } = renderShortcuts();
    key("c");
    expect(router.push).toHaveBeenCalledWith("/en-US/platform/experiments/new");
  });

  it("/ focuses the page's inline search input", () => {
    renderShortcuts(<input type="search" data-testid="search" />);
    key("/");
    expect(document.activeElement).toBe(document.querySelector('input[type="search"]'));
  });

  it("does not fire single-key shortcuts while typing in an input", () => {
    const { router } = renderShortcuts(<input data-testid="field" />);
    const field = screen.getByTestId("field");
    fireEvent.keyDown(field, { key: "g" });
    fireEvent.keyDown(field, { key: "e" });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows a 'Go to…' hint when entering g-mode", () => {
    renderShortcuts(<ShortcutHint />);
    key("g");
    expect(screen.getByText("Go to…")).toBeInTheDocument();
  });
});
