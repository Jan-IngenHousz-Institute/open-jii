import { render, screen } from "@/test/test-utils";
import { Position } from "@xyflow/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import type { NodeType } from "../node-config";
import { NodeHandles, getHandlePositionClasses } from "../node-handles";

vi.mock("../node-config", () => ({
  nodeTypeColorMap: {
    QUESTION: { border: "border-red-500", bg: "bg-red-50" },
    INSTRUCTION: { border: "border-blue-500", bg: "bg-blue-50" },
    MEASUREMENT: { border: "border-green-500", bg: "bg-green-50" },
    ANALYSIS: { border: "border-yellow-500", bg: "bg-yellow-50" },
    default: { border: "border-gray-500", bg: "bg-gray-50" },
  },
}));

vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@xyflow/react");
  return {
    ...actual,
    Handle: (props: React.ComponentProps<"div"> & { id: string }) => (
      <div role="handle" data-id={props.id} className={props.className} />
    ),
  };
});

describe("getHandlePositionClasses", () => {
  it("returns correct class for left", () => {
    expect(getHandlePositionClasses(Position.Left)).toContain("left-0");
  });
  it("returns correct class for right", () => {
    expect(getHandlePositionClasses(Position.Right)).toContain("right-0");
  });
  it("returns correct class for top", () => {
    expect(getHandlePositionClasses(Position.Top)).toContain("top-0");
  });
  it("returns correct class for bottom", () => {
    expect(getHandlePositionClasses(Position.Bottom)).toContain("bottom-0");
  });
  it("returns default class for unsupported position", () => {
    expect(getHandlePositionClasses("invalid" as unknown as Position)).toContain("right-0");
  });
});

describe("NodeHandles", () => {
  it("renders only input handle when hasInput=true", () => {
    render(
      <NodeHandles
        hasInput
        hasOutput={false}
        inputPosition={Position.Left}
        outputPosition={Position.Right}
      />,
    );
    const inputHandle = screen.getByRole("handle");
    expect(inputHandle).toHaveAttribute("data-id", "in");
  });

  it("renders only output handle when hasOutput=true", () => {
    render(
      <NodeHandles
        hasInput={false}
        hasOutput
        inputPosition={Position.Left}
        outputPosition={Position.Right}
      />,
    );
    const outputHandle = screen.getByRole("handle");
    expect(outputHandle).toHaveAttribute("data-id", "out");
  });

  it("renders both handles when hasInput and hasOutput", () => {
    render(
      <NodeHandles
        hasInput
        hasOutput
        inputPosition={Position.Top}
        outputPosition={Position.Bottom}
      />,
    );
    const handles = screen.getAllByRole("handle");
    expect(handles).toHaveLength(2);
  });

  it("applies highlight classes when selected", () => {
    render(
      <NodeHandles
        hasInput
        hasOutput
        inputPosition={Position.Left}
        outputPosition={Position.Right}
        selected
      />,
    );
    const handles = screen.getAllByRole("handle");
    handles.forEach((h) => {
      expect(h.className).toMatch(/!border-jii-dark-green/);
      expect(h.className).toMatch(/opacity-100/);
    });
  });

  it("applies highlight classes when dragging", () => {
    render(
      <NodeHandles
        hasInput
        hasOutput
        inputPosition={Position.Left}
        outputPosition={Position.Right}
        dragging
      />,
    );
    const handles = screen.getAllByRole("handle");
    handles.forEach((h) => {
      expect(h.className).toMatch(/!border-jii-dark-green/);
      expect(h.className).toMatch(/opacity-100/);
    });
  });

  it("applies nodeType color classes when not selected/dragging", () => {
    render(
      <NodeHandles
        hasInput
        hasOutput
        inputPosition={Position.Left}
        outputPosition={Position.Right}
        nodeType={"QUESTION" as NodeType}
      />,
    );
    const handles = screen.getAllByRole("handle");
    handles.forEach((h) => {
      expect(h.className).toMatch(/border-red-500/);
      expect(h.className).toMatch(/bg-red-50/);
    });
  });

  it("falls back to gray when no nodeType", () => {
    render(
      <NodeHandles
        hasInput
        hasOutput
        inputPosition={Position.Left}
        outputPosition={Position.Right}
      />,
    );
    const handles = screen.getAllByRole("handle");
    handles.forEach((h) => {
      expect(h.className).toMatch(/!border-slate-300/);
      expect(h.className).toMatch(/!bg-slate-100/);
    });
  });
});
