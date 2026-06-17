import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDeselectOnOutsideClick } from "./use-deselect-on-outside-click";

interface SetupOpts {
  tool?: "cursor" | "chart";
  selectedWidgetId?: string | null;
}

function setup(opts: SetupOpts = {}) {
  const selectWidget = vi.fn();
  const setTool = vi.fn();
  const tool = opts.tool ?? "cursor";
  const selectedWidgetId: string | null =
    "selectedWidgetId" in opts ? (opts.selectedWidgetId ?? null) : "w1";

  const { rerender, unmount } = renderHook(() =>
    useDeselectOnOutsideClick({ tool, selectedWidgetId, selectWidget, setTool }),
  );
  return { selectWidget, setTool, rerender, unmount };
}

function dispatchPointerDown(target: HTMLElement) {
  // Bubbles to document where the hook attaches its listener.
  target.dispatchEvent(new Event("pointerdown", { bubbles: true }));
}

describe("useDeselectOnOutsideClick", () => {
  it("does nothing when no widget is selected", () => {
    const { selectWidget } = setup({ selectedWidgetId: null });
    const outside = document.createElement("div");
    document.body.appendChild(outside);

    act(() => dispatchPointerDown(outside));
    expect(selectWidget).not.toHaveBeenCalled();
  });

  it("deselects on pointerdown outside any widget / sidebar / radix portal", () => {
    const { selectWidget } = setup({ selectedWidgetId: "w1" });
    const outside = document.createElement("div");
    document.body.appendChild(outside);

    act(() => dispatchPointerDown(outside));
    expect(selectWidget).toHaveBeenCalledWith(null);
  });

  it("ignores pointerdown that lands inside a widget", () => {
    const { selectWidget } = setup({ selectedWidgetId: "w1" });
    const widget = document.createElement("div");
    widget.setAttribute("data-dashboard-widget", "");
    document.body.appendChild(widget);

    act(() => dispatchPointerDown(widget));
    expect(selectWidget).not.toHaveBeenCalled();
  });

  it("ignores pointerdown on the inspector sidebar so toggling controls keeps the selection", () => {
    const { selectWidget } = setup({ selectedWidgetId: "w1" });
    const sidebar = document.createElement("div");
    sidebar.setAttribute("data-editor-chrome", "");
    document.body.appendChild(sidebar);

    act(() => dispatchPointerDown(sidebar));
    expect(selectWidget).not.toHaveBeenCalled();
  });

  it("ignores pointerdown that originates from a Radix portal (popovers, menus)", () => {
    const { selectWidget } = setup({ selectedWidgetId: "w1" });
    const portal = document.createElement("div");
    portal.setAttribute("data-radix-popper-content-wrapper", "");
    document.body.appendChild(portal);

    act(() => dispatchPointerDown(portal));
    expect(selectWidget).not.toHaveBeenCalled();
  });

  it("does not deselect during placement mode (pointer down drops a widget instead)", () => {
    const { selectWidget } = setup({ tool: "chart", selectedWidgetId: "w1" });
    const outside = document.createElement("div");
    document.body.appendChild(outside);

    act(() => dispatchPointerDown(outside));
    expect(selectWidget).not.toHaveBeenCalled();
  });

  it("Escape during placement mode resets the tool to cursor first (not deselect)", () => {
    const { selectWidget, setTool } = setup({ tool: "chart", selectedWidgetId: "w1" });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(setTool).toHaveBeenCalledWith("cursor");
    expect(selectWidget).not.toHaveBeenCalled();
  });

  it("Escape with a selected widget and cursor tool clears the selection", () => {
    const { selectWidget } = setup({ tool: "cursor", selectedWidgetId: "w1" });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(selectWidget).toHaveBeenCalledWith(null);
  });

  it("removes its event listeners on unmount", () => {
    const { selectWidget, unmount } = setup({ selectedWidgetId: "w1" });
    unmount();
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    act(() => dispatchPointerDown(outside));
    expect(selectWidget).not.toHaveBeenCalled();
  });
});
