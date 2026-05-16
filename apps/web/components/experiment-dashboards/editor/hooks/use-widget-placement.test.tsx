import { stubBoundingRect } from "@/test/drag";
import { act } from "@testing-library/react";
import { renderHook as rtlRenderHook } from "@testing-library/react";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { DashboardFormValues } from "../../dashboard-form-shell";
import type { DashboardTool } from "../context/dashboard-editor-context";
import { useWidgetPlacement } from "./use-widget-placement";

// jsdom lacks PointerEvent; synthesize one via a plain Event with the coords
// the hook reads off the live event.
function pointerEvent(type: string, props: { clientX?: number; clientY?: number } = {}) {
  // jsdom omits PointerEvent. MouseEvent carries clientX/Y and dispatches to
  // pointer-typed listeners just fine.
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: props.clientX ?? 0,
    clientY: props.clientY ?? 0,
  });
}

function makeDefaults(): DashboardFormValues {
  return {
    name: "Dash",
    description: "",
    layout: { columns: 12, rowHeight: 80, gap: 16 },
    widgets: [],
  };
}

interface Harness {
  form: UseFormReturn<DashboardFormValues>;
  containerRef: { current: HTMLDivElement | null };
  snap: { col: number; row: number } | null;
}

function setup(tool: DashboardTool, onPlaced: (id: string) => void = vi.fn()) {
  // Use a real DOM node so the hook's getBoundingClientRect works.
  const node = document.createElement("div");
  stubBoundingRect(node, { left: 0, top: 0, width: 1200, height: 800 });
  document.body.appendChild(node);

  const utils = rtlRenderHook<Harness, void>(() => {
    const form = useForm<DashboardFormValues>({ defaultValues: makeDefaults() });
    const containerRef = useRef<HTMLDivElement | null>(node);
    const snap = useWidgetPlacement({
      tool,
      containerRef,
      width: 1200,
      columns: 12,
      gap: 16,
      rowHeight: 80,
      form,
      onPlaced,
    });
    return { form, containerRef, snap };
  });

  return { ...utils, node };
}

describe("useWidgetPlacement", () => {
  it("returns null while the cursor tool is active", () => {
    const { result } = setup("cursor");
    expect(result.current.snap).toBeNull();
  });

  it("snaps to a grid cell when the pointer moves over the container", () => {
    const { node, result } = setup("chart");
    act(() => {
      node.dispatchEvent(pointerEvent("pointermove", { clientX: 100, clientY: 100 }));
    });
    expect(result.current.snap).not.toBeNull();
    expect(result.current.snap?.col).toBeGreaterThanOrEqual(0);
    expect(result.current.snap?.row).toBeGreaterThanOrEqual(0);
  });

  it("clears the snap target when the pointer leaves the container", () => {
    const { node, result } = setup("chart");
    act(() => {
      node.dispatchEvent(pointerEvent("pointermove", { clientX: 100, clientY: 100 }));
    });
    expect(result.current.snap).not.toBeNull();
    act(() => {
      node.dispatchEvent(pointerEvent("pointerleave"));
    });
    expect(result.current.snap).toBeNull();
  });

  it("places a new widget into the form on click and calls onPlaced with its id", () => {
    const onPlaced = vi.fn<(id: string) => void>();
    const { node, result } = setup("filter", onPlaced);

    act(() => {
      const evt = new MouseEvent("click", {
        clientX: 200,
        clientY: 200,
        bubbles: true,
        cancelable: true,
      });
      node.dispatchEvent(evt);
    });

    expect(onPlaced).toHaveBeenCalledExactlyOnceWith(expect.any(String));
    const widgets = result.current.form.getValues("widgets");
    expect(widgets).toHaveLength(1);
    expect(widgets[0].id).toBe(onPlaced.mock.calls[0][0]);
    expect(widgets[0].type).toBe("filter");
  });

  it("ignores clicks that land outside the container's bounding rect", () => {
    const onPlaced = vi.fn();
    const { node, result } = setup("chart", onPlaced);

    act(() => {
      const evt = new MouseEvent("click", {
        clientX: 2000,
        clientY: 2000,
        bubbles: true,
        cancelable: true,
      });
      node.dispatchEvent(evt);
    });

    expect(onPlaced).not.toHaveBeenCalled();
    expect(result.current.form.getValues("widgets")).toHaveLength(0);
  });

  it("clamps the snapped column so the widget stays within usableColumns", () => {
    const { node, result } = setup("chart");
    // Far-right pointer: the snap col should be clamped to leave room for the widget span.
    act(() => {
      node.dispatchEvent(pointerEvent("pointermove", { clientX: 1150, clientY: 50 }));
    });
    expect(result.current.snap).not.toBeNull();
    // usableColumns is 9; chart default colSpan is at most 9 -> col must be <= 9 - colSpan.
    expect(result.current.snap?.col).toBeLessThanOrEqual(9);
  });

  it("auto-stacks a new widget to the next available row, even when the click lands far below", () => {
    // No `static: true` on the draft: verticalCompactor packs the new
    // widget directly under the existing ones, avoiding an unfillable
    // band between them.
    const onPlaced = vi.fn<(id: string) => void>();
    const node = document.createElement("div");
    stubBoundingRect(node, { left: 0, top: 0, width: 1200, height: 1500 });
    document.body.appendChild(node);

    const existingWidget = {
      id: "existing",
      type: "richText" as const,
      layout: { col: 0, row: 0, colSpan: 6, rowSpan: 4 },
      config: { html: "" },
    };

    const utils = rtlRenderHook<Harness, void>(() => {
      const form = useForm<DashboardFormValues>({
        defaultValues: {
          name: "Dash",
          description: "",
          layout: { columns: 12, rowHeight: 80, gap: 16 },
          widgets: [existingWidget],
        },
      });
      const containerRef = useRef<HTMLDivElement | null>(node);
      const snap = useWidgetPlacement({
        tool: "chart",
        containerRef,
        width: 1200,
        columns: 12,
        gap: 16,
        rowHeight: 80,
        form,
        onPlaced,
      });
      return { form, containerRef, snap };
    });

    // rowPitch = rowHeight + gap = 96. Click at y=800 snaps to row 8.
    // Existing widget occupies rows 0-3; the auto-stacked new widget
    // should compact up to row 4 instead of staying at row 8.
    act(() => {
      const evt = new MouseEvent("click", {
        clientX: 100,
        clientY: 800,
        bubbles: true,
        cancelable: true,
      });
      node.dispatchEvent(evt);
    });

    const widgets = utils.result.current.form.getValues("widgets");
    expect(widgets).toHaveLength(2);

    const existing = widgets.find((w) => w.id === "existing");
    const placed = widgets.find((w) => w.id !== "existing");
    expect(existing?.layout.row).toBe(0);

    // No gap: the new widget starts immediately after the existing
    // widget ends (row = existing.row + existing.rowSpan).
    const existingEnd = (existing?.layout.row ?? 0) + (existing?.layout.rowSpan ?? 0);
    expect(placed?.layout.row).toBe(existingEnd);
  });
});
