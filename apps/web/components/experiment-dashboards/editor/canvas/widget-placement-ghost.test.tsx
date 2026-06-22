import { act, render, screen } from "@/test/test-utils";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { DashboardEditorProvider, useDashboardEditor } from "../context/dashboard-editor-context";
import { WidgetPlacementGhost } from "./widget-placement-ghost";

function ToolToggle({ tool }: { tool: "cursor" | "chart" | "text" | "table" | "filter" }) {
  const { setTool } = useDashboardEditor();
  // Drive the tool via a button so the test stays in render order.
  return (
    <button type="button" onClick={() => setTool(tool)} data-testid={`pick-${tool}`}>
      {tool}
    </button>
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return <DashboardEditorProvider>{children}</DashboardEditorProvider>;
}

describe("WidgetPlacementGhost", () => {
  it("renders nothing while the cursor tool is active", () => {
    render(
      <Wrapper>
        <WidgetPlacementGhost />
      </Wrapper>,
    );
    expect(screen.queryByText("editor.modebar.dropHint")).toBeNull();
  });

  it("renders nothing in placement mode until the pointer moves (no position yet)", () => {
    render(
      <Wrapper>
        <ToolToggle tool="chart" />
        <WidgetPlacementGhost />
      </Wrapper>,
    );
    // Click the toggle to enter placement mode.
    act(() => screen.getByTestId("pick-chart").click());
    // Until a pointermove fires, no ghost coordinates exist.
    expect(screen.queryByText("editor.modebar.dropHint")).toBeNull();
  });

  it("renders the widget label and drop hint once the pointer moves in placement mode", () => {
    render(
      <Wrapper>
        <ToolToggle tool="chart" />
        <WidgetPlacementGhost />
      </Wrapper>,
    );
    act(() => screen.getByTestId("pick-chart").click());
    act(() => {
      const evt = new Event("pointermove");
      Object.assign(evt, { clientX: 50, clientY: 60 });
      window.dispatchEvent(evt);
    });
    expect(screen.getByText("editor.widgetTypes.visualization")).toBeInTheDocument();
    expect(screen.getByText("editor.modebar.dropHint")).toBeInTheDocument();
  });

  it("clears the ghost when the tool returns to cursor", () => {
    function CursorToggle() {
      const { setTool } = useDashboardEditor();
      return (
        <button type="button" onClick={() => setTool("cursor")} data-testid="pick-cursor">
          cursor
        </button>
      );
    }
    render(
      <Wrapper>
        <ToolToggle tool="chart" />
        <CursorToggle />
        <WidgetPlacementGhost />
      </Wrapper>,
    );
    act(() => screen.getByTestId("pick-chart").click());
    act(() => {
      const evt = new Event("pointermove");
      Object.assign(evt, { clientX: 50, clientY: 60 });
      window.dispatchEvent(evt);
    });
    expect(screen.getByText("editor.modebar.dropHint")).toBeInTheDocument();

    act(() => screen.getByTestId("pick-cursor").click());
    expect(screen.queryByText("editor.modebar.dropHint")).toBeNull();
  });
});
