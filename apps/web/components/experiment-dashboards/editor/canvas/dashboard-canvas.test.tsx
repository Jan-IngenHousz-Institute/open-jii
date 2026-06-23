import { server } from "@/test/msw/server";
import { act, renderWithForm, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/experiment.schema";

import type { DashboardFormValues } from "../../dashboard-form-shell";
import { DashboardEditorProvider, useDashboardEditor } from "../context/dashboard-editor-context";
import { DashboardCanvas } from "./dashboard-canvas";

type DashboardEditor = ReturnType<typeof useDashboardEditor>;

function setup(opts: { widgets?: ExperimentDashboardWidget[] } = {}) {
  server.mount(contract.experiments.getExperimentTables, { body: [] });

  const editorRef: { current: DashboardEditor | null } = { current: null };
  function EditorCapture() {
    editorRef.current = useDashboardEditor();
    return null;
  }
  const result = renderWithForm<DashboardFormValues>(
    () => (
      <DashboardEditorProvider>
        <EditorCapture />
        <DashboardCanvas experimentId="exp-1" />
      </DashboardEditorProvider>
    ),
    {
      useFormProps: {
        defaultValues: {
          name: "Dash",
          description: "",
          layout: { columns: 12, rowHeight: 80, gap: 16 },
          widgets: opts.widgets ?? [],
        },
      },
    },
  );
  if (!editorRef.current) throw new Error("editor context did not mount");
  return { ...result, editor: editorRef.current };
}

describe("DashboardCanvas", () => {
  it("shows the empty-state overlay when there are no widgets and the cursor tool is active", () => {
    setup();
    expect(screen.getByText("ui.messages.emptyDashboard")).toBeInTheDocument();
  });

  it("renders one selectable card per widget", () => {
    const widgets: ExperimentDashboardWidget[] = [
      {
        id: "rt-1",
        type: "richText",
        layout: { col: 0, row: 0, colSpan: 6, rowSpan: 2 },
        config: { html: "<p>first</p>" },
      },
      {
        id: "rt-2",
        type: "richText",
        layout: { col: 6, row: 0, colSpan: 6, rowSpan: 2 },
        config: { html: "<p>second</p>" },
      },
    ];
    setup({ widgets });
    expect(screen.getByText(/first/)).toBeInTheDocument();
    expect(screen.getByText(/second/)).toBeInTheDocument();
  });

  it("renders the widgets in row-then-column reading order (DOM order matches a11y order)", () => {
    const widgets: ExperimentDashboardWidget[] = [
      // Bottom-row first in widget list, but should render after top-row card.
      {
        id: "bottom",
        type: "richText",
        layout: { col: 0, row: 4, colSpan: 6, rowSpan: 2 },
        config: { html: "<p>bottom</p>" },
      },
      {
        id: "top",
        type: "richText",
        layout: { col: 0, row: 0, colSpan: 6, rowSpan: 2 },
        config: { html: "<p>top</p>" },
      },
    ];
    setup({ widgets });
    // Find each rendered <p>top</p> / <p>bottom</p> body, then walk up to its widget card.
    const topPara = screen.getByText("top");
    const bottomPara = screen.getByText("bottom");
    const cards = Array.from(document.querySelectorAll("[data-dashboard-widget]"));
    const topIdx = cards.findIndex((el) => el.contains(topPara));
    const bottomIdx = cards.findIndex((el) => el.contains(bottomPara));
    expect(topIdx).toBeGreaterThanOrEqual(0);
    expect(bottomIdx).toBeGreaterThanOrEqual(0);
    expect(topIdx).toBeLessThan(bottomIdx);
  });

  it("scrolls the selected widget into view", () => {
    const widgets: ExperimentDashboardWidget[] = [
      {
        id: "rt-1",
        type: "richText",
        layout: { col: 0, row: 0, colSpan: 6, rowSpan: 2 },
        config: { html: "<p>focus</p>" },
      },
    ];
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView");
    const { editor } = setup({ widgets });

    act(() => editor.selectWidget("rt-1"));

    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it("flips into placement mode (crosshair cursor + min-h spacer) when a non-cursor tool is active", () => {
    const { editor, container } = setup();

    act(() => editor.setTool("chart"));

    const root = container.querySelector(".dashboard-canvas-root");
    expect(root?.className).toContain("cursor-crosshair");
    expect(root?.className).toContain("min-h-[60vh]");
  });

  it("hides the empty-state overlay during placement mode so the canvas surface is clickable", () => {
    const { editor } = setup();

    expect(screen.getByText("ui.messages.emptyDashboard")).toBeInTheDocument();
    act(() => editor.setTool("text"));

    expect(screen.queryByText("ui.messages.emptyDashboard")).not.toBeInTheDocument();
  });

  it("places a widget into the form and switches back to the cursor tool on canvas click in placement mode", () => {
    // jsdom returns 0 for offsetWidth so RGL's useContainerWidth collapses
    // to width=0; stub the prototype getter to satisfy the snap geometry.
    const offsetWidthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 1200,
    });

    try {
      const { editor, form, container } = setup();
      act(() => editor.setTool("text"));

      const root = container.querySelector(".dashboard-canvas-root");
      if (!(root instanceof HTMLElement)) throw new Error("expected canvas root");

      // Give the container a rect inside which clientX/Y maps to col 0 row 0.
      Object.defineProperty(root, "getBoundingClientRect", {
        configurable: true,
        value: () =>
          ({
            top: 0,
            left: 0,
            right: 1200,
            bottom: 800,
            width: 1200,
            height: 800,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }) as DOMRect,
      });

      const click = new MouseEvent("click", { bubbles: true, cancelable: true });
      Object.defineProperty(click, "clientX", { value: 50 });
      Object.defineProperty(click, "clientY", { value: 50 });
      act(() => {
        root.dispatchEvent(click);
      });

      // Placement appends a new widget and switches the tool back to cursor.
      expect(form.getValues("widgets")).toHaveLength(1);
      expect(form.getValues("widgets.0.type")).toBe("richText");
      expect(editor.tool).toBe("cursor");
    } finally {
      if (offsetWidthDesc) {
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", offsetWidthDesc);
      }
    }
  });
});
