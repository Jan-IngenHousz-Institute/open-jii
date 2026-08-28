import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  Sidebar,
  SidebarEdgePeek,
  SidebarFloatingReopen,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "../sidebar";

const STORAGE_KEY = "openjii.sidebar";

window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList;

// jsdom lacks pointer-capture; the resize rail calls these.
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);

function Consumer() {
  const { state, open, width, peeking, dragging, setWidth, setOpen, setPeeking, toggleSidebar } =
    useSidebar();
  return (
    <div>
      <span data-testid="state">{state}</span>
      <span data-testid="open">{String(open)}</span>
      <span data-testid="width">{width}</span>
      <span data-testid="peeking">{String(peeking)}</span>
      <span data-testid="dragging">{String(dragging)}</span>
      <button data-testid="set-300" onClick={() => setWidth(300)} />
      <button data-testid="set-max" onClick={() => setWidth(9999)} />
      <button data-testid="set-min" onClick={() => setWidth(10)} />
      <button data-testid="close" onClick={() => setOpen(false)} />
      <button data-testid="peek-on" onClick={() => setPeeking(true)} />
      <button data-testid="toggle" onClick={toggleSidebar} />
    </div>
  );
}

function renderWithRail(props?: { defaultOpen?: boolean; side?: "left" | "right" }) {
  return render(
    <SidebarProvider defaultOpen={props?.defaultOpen ?? true}>
      <Sidebar collapsible="hidden" side={props?.side}>
        <div>content</div>
        <SidebarRail resizable />
      </Sidebar>
      <Consumer />
    </SidebarProvider>,
  );
}

const widthEl = () => screen.getByTestId("width");
const widthVal = () => Number(widthEl().textContent);

// jsdom's PointerEvent ignores clientX; dispatch a MouseEvent typed as a
// pointer event instead (React maps it to onPointerDown/Move/Up and it carries
// clientX/button correctly).
function firePointer(el: Element, type: string, opts: { clientX?: number; button?: number } = {}) {
  const ev = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: opts.clientX ?? 0,
    button: opts.button ?? 0,
  });
  Object.defineProperty(ev, "pointerId", { value: 1, configurable: true });
  act(() => {
    el.dispatchEvent(ev);
  });
}

beforeEach(() => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  vi.clearAllMocks();
});

describe("SidebarProvider width + persistence", () => {
  it("uses an optional app-specific default without changing the shared default", () => {
    const { unmount } = render(
      <SidebarProvider defaultWidth={232}>
        <Consumer />
      </SidebarProvider>,
    );
    expect(widthVal()).toBe(232);

    unmount();
    window.localStorage.removeItem(STORAGE_KEY);
    render(
      <SidebarProvider>
        <Consumer />
      </SidebarProvider>,
    );
    expect(widthVal()).toBe(268);
  });

  it("hydrates width and collapsed state from localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ width: 320, collapsed: true }));
    render(
      <SidebarProvider>
        <Consumer />
      </SidebarProvider>,
    );
    expect(widthVal()).toBe(320);
    expect(screen.getByTestId("state")).toHaveTextContent("collapsed");
  });

  it("migrates the former shared default to an app-specific default", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ width: 268 }));

    render(
      <SidebarProvider defaultWidth={232}>
        <Consumer />
      </SidebarProvider>,
    );

    expect(widthVal()).toBe(232);
  });

  it("preserves an intentional resize back to the former shared width", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ width: 268, defaultWidth: 232 }));

    render(
      <SidebarProvider defaultWidth={232}>
        <Consumer />
      </SidebarProvider>,
    );

    expect(widthVal()).toBe(268);
  });

  it("clamps width to the min/max bounds", () => {
    render(
      <SidebarProvider>
        <Consumer />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByTestId("set-max"));
    expect(widthVal()).toBe(360);
    fireEvent.click(screen.getByTestId("set-min"));
    expect(widthVal()).toBe(220);
  });

  it("persists width and collapsed to localStorage", () => {
    render(
      <SidebarProvider>
        <Consumer />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByTestId("set-300"));
    fireEvent.click(screen.getByTestId("close"));
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.width).toBe(300);
    expect(stored.collapsed).toBe(true);
    expect(document.cookie).toContain("sidebar_state=false");
  });

  it("clears the peek state once the sidebar opens", () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <Consumer />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByTestId("peek-on"));
    expect(screen.getByTestId("peeking")).toHaveTextContent("true");
    fireEvent.click(screen.getByTestId("toggle")); // open
    expect(screen.getByTestId("peeking")).toHaveTextContent("false");
  });
});

describe("SidebarRail (resizable)", () => {
  it("exposes separator semantics", () => {
    renderWithRail();
    const rail = screen.getByRole("separator", { name: "Resize sidebar" });
    expect(rail).toHaveAttribute("aria-orientation", "vertical");
    expect(rail).toHaveAttribute("aria-valuemin", "220");
    expect(rail).toHaveAttribute("aria-valuemax", "360");
    expect(rail).toHaveAttribute("tabindex", "0");
  });

  it("resizes on pointer drag and persists on release", () => {
    renderWithRail();
    const rail = screen.getByRole("separator", { name: "Resize sidebar" });
    const start = widthVal();
    firePointer(rail, "pointerdown", { clientX: start });
    firePointer(rail, "pointermove", { clientX: start + 50 });
    expect(widthVal()).toBe(start + 50);
    firePointer(rail, "pointerup");
    expect(screen.getByTestId("dragging")).toHaveTextContent("false");
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.width).toBe(start + 50);
  });

  it("snaps to collapsed when dragged below the threshold", () => {
    renderWithRail();
    const rail = screen.getByRole("separator", { name: "Resize sidebar" });
    const start = widthVal();
    firePointer(rail, "pointerdown", { clientX: start });
    firePointer(rail, "pointermove", { clientX: 50 }); // next = 50 < 180
    expect(screen.getByTestId("state")).toHaveTextContent("collapsed");
  });

  it("ignores non-primary mouse buttons", () => {
    renderWithRail();
    const rail = screen.getByRole("separator", { name: "Resize sidebar" });
    const start = widthVal();
    firePointer(rail, "pointerdown", { clientX: start, button: 2 });
    firePointer(rail, "pointermove", { clientX: start + 80 });
    expect(widthVal()).toBe(start); // no drag started
  });

  it("toggles on double-click", () => {
    renderWithRail();
    const rail = screen.getByRole("separator", { name: "Resize sidebar" });
    expect(screen.getByTestId("state")).toHaveTextContent("expanded");
    fireEvent.doubleClick(rail);
    expect(screen.getByTestId("state")).toHaveTextContent("collapsed");
  });

  it("resizes and toggles via the keyboard", () => {
    renderWithRail();
    const rail = screen.getByRole("separator", { name: "Resize sidebar" });
    fireEvent.keyDown(rail, { key: "Home" });
    expect(widthVal()).toBe(220);
    fireEvent.keyDown(rail, { key: "ArrowRight" });
    expect(widthVal()).toBe(228);
    fireEvent.keyDown(rail, { key: "ArrowLeft" });
    expect(widthVal()).toBe(220);
    fireEvent.keyDown(rail, { key: "End" });
    expect(widthVal()).toBe(360);
    fireEvent.keyDown(rail, { key: "Enter" });
    expect(screen.getByTestId("state")).toHaveTextContent("collapsed");
  });

  it("inverts drag and keyboard direction for a right-side sidebar", () => {
    renderWithRail({ side: "right" });
    fireEvent.click(screen.getByTestId("set-300"));
    const rail = screen.getByRole("separator", { name: "Resize sidebar" });
    // Moving the left-edge handle right shrinks a right-anchored sidebar.
    firePointer(rail, "pointerdown", { clientX: 300 });
    firePointer(rail, "pointermove", { clientX: 350 });
    expect(widthVal()).toBe(250);
    firePointer(rail, "pointerup");
    // ArrowRight shrinks on the right side too.
    fireEvent.keyDown(rail, { key: "End" });
    fireEvent.keyDown(rail, { key: "ArrowRight" });
    expect(widthVal()).toBe(352);
  });

  it("toggles on click when not resizable", () => {
    render(
      <SidebarProvider>
        <Sidebar collapsible="hidden">
          <div>content</div>
        </Sidebar>
        <SidebarRail />
        <Consumer />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("state")).toHaveTextContent("expanded");
    fireEvent.click(screen.getByLabelText("Toggle Sidebar"));
    expect(screen.getByTestId("state")).toHaveTextContent("collapsed");
  });
});

describe("SidebarEdgePeek", () => {
  it("triggers a peek on hover while collapsed", () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarEdgePeek data-testid="edge" />
        <Consumer />
      </SidebarProvider>,
    );
    const edge = screen.getByTestId("edge");
    fireEvent.mouseEnter(edge);
    expect(screen.getByTestId("peeking")).toHaveTextContent("true");
  });

  it("renders nothing when the sidebar is open", () => {
    render(
      <SidebarProvider defaultOpen>
        <SidebarEdgePeek data-testid="edge" />
        <Consumer />
      </SidebarProvider>,
    );
    expect(screen.queryByTestId("edge")).not.toBeInTheDocument();
  });
});

describe("Sidebar peek overlay", () => {
  it("applies the peek overlay when collapsed in offcanvas mode", () => {
    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar collapsible="offcanvas">
          <div>content</div>
        </Sidebar>
        <Consumer />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByTestId("peek-on"));
    const sidebar = container.querySelector('[data-peeking="true"]');
    expect(sidebar).not.toBeNull();
    expect(sidebar?.querySelector(".fixed")?.className).toContain(
      "group-data-[collapsible=offcanvas]:z-50",
    );
  });

  it("never peeks in icon mode, where the collapsed sidebar stays visible", () => {
    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar collapsible="icon">
          <div>content</div>
        </Sidebar>
        <Consumer />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByTestId("peek-on"));
    expect(container.querySelector("[data-peeking]")).toBeNull();
  });

  it("does not apply the left-edge peek path to a right-side offcanvas sidebar", () => {
    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar side="right" collapsible="offcanvas">
          <div>content</div>
        </Sidebar>
        <Consumer />
      </SidebarProvider>,
    );

    fireEvent.click(screen.getByTestId("peek-on"));
    expect(container.querySelector("[data-peeking]")).toBeNull();
  });
});

describe("SidebarTrigger mobile affordance", () => {
  it("shows open while the mobile drawer is closed and close after it opens", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) =>
      ({
        matches: query.includes("max-width"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList;

    try {
      const { container } = render(
        <SidebarProvider>
          <SidebarTrigger />
        </SidebarProvider>,
      );

      await waitFor(() =>
        expect(container.querySelector(".lucide-panel-left-open")).not.toBeNull(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
      expect(container.querySelector(".lucide-panel-left-close")).not.toBeNull();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("uses the sheet close action instead of a second collapse trigger inside the drawer", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) =>
      ({
        matches: query.includes("max-width"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList;

    try {
      render(
        <SidebarProvider>
          <Sidebar>
            <div>content</div>
          </Sidebar>
          <SidebarTrigger />
        </SidebarProvider>,
      );

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeVisible(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
      expect(await screen.findByRole("button", { name: "Close" })).toBeVisible();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe("SidebarFloatingReopen", () => {
  it("shows when collapsed and re-opens on click", () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarFloatingReopen />
        <Consumer />
      </SidebarProvider>,
    );
    const btn = screen.getByRole("button", { name: "Open sidebar" });
    fireEvent.click(btn);
    expect(screen.getByTestId("state")).toHaveTextContent("expanded");
  });

  it("renders nothing when the sidebar is open", () => {
    render(
      <SidebarProvider defaultOpen>
        <SidebarFloatingReopen />
        <Consumer />
      </SidebarProvider>,
    );
    expect(screen.queryByRole("button", { name: "Open sidebar" })).not.toBeInTheDocument();
  });
});
