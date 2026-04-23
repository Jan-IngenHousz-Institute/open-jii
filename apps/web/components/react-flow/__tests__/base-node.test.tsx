// BaseNode.test.tsx
import { render, screen, userEvent } from "@/test/test-utils";
import { Position } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { BaseNode, getHandlePositions } from "../base-node";
import type { NodeType } from "../node-config";

const baseNodeDefaults = {
  type: "QUESTION" as const,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 1,
  selectable: true,
  deletable: true,
  draggable: true,
  selected: false,
  width: 100,
  height: 60,
  measured: { width: 100, height: 60 },
};

vi.mock("../node-content", () => ({
  NodeContent: (props: {
    title: string;
    nodeType: NodeType;
    hasInput: boolean;
    hasOutput: boolean;
    inputPosition: Position;
    outputPosition: Position;
    selected?: boolean;
    dragging?: boolean;
    isStartNode?: boolean;
  }) => (
    <div data-testid="node-content">
      <span>{props.title}</span>
      <span>{props.nodeType}</span>
      <span>{props.hasInput ? "in" : "no-in"}</span>
      <span>{props.hasOutput ? "out" : "no-out"}</span>
    </div>
  ),
}));

vi.mock("../node-config", () => ({
  nodeTypeColorMap: {
    QUESTION: { accent: "#C58AAE" },
    INSTRUCTION: { accent: "#6F8596" },
    MEASUREMENT: { accent: "#2D3142" },
    ANALYSIS: { accent: "#6C5CE7" },
  },
}));

describe("getHandlePositions", () => {
  it("returns defaults when src/tgt undefined", () => {
    const res = getHandlePositions();
    expect(res.hasInput).toBe(false);
    expect(res.hasOutput).toBe(false);
    expect(res.inputPosition).toBe(Position.Left);
    expect(res.outputPosition).toBe(Position.Right);
  });

  it("returns with src and tgt", () => {
    const res = getHandlePositions(Position.Top, Position.Bottom);
    expect(res.hasInput).toBe(true);
    expect(res.hasOutput).toBe(true);
    expect(res.inputPosition).toBe(Position.Bottom);
    expect(res.outputPosition).toBe(Position.Top);
  });

  it("handles string values case-insensitively", () => {
    const res = getHandlePositions("LEFT", "RIGHT");
    expect(res.inputPosition).toBe(Position.Right);
    expect(res.outputPosition).toBe(Position.Left);
  });
});

describe("BaseNode", () => {
  const node: Node = {
    id: "n1",
    type: "QUESTION",
    position: { x: 0, y: 0 },
    data: { title: "My Node" },
  };

  it("renders with title and node-content", () => {
    render(<BaseNode nodes={[node]} onNodeDelete={() => null} {...node} {...baseNodeDefaults} />);
    expect(screen.getByText("My Node")).toBeInTheDocument();
    expect(screen.getByTestId("node-content")).toBeInTheDocument();
  });

  it("calls onNodeDelete when delete clicked", async () => {
    const onDelete = vi.fn();
    render(<BaseNode nodes={[node]} onNodeDelete={onDelete} {...node} {...baseNodeDefaults} />);
    const btn = screen.getByRole("button", { name: /delete node/i });
    const user = userEvent.setup();
    await user.click(btn);
    expect(onDelete).toHaveBeenCalledWith("n1");
  });

  it("does not render delete button when isStatic", () => {
    render(
      <BaseNode
        nodes={[node]}
        onNodeDelete={() => null}
        isStatic
        {...node}
        {...baseNodeDefaults}
      />,
    );
    expect(screen.queryByRole("button", { name: /delete node/i })).toBeNull();
  });

  it("calls onNodeSelect with the node when clicked", async () => {
    const onSelect = vi.fn();
    render(
      <BaseNode
        nodes={[node]}
        onNodeDelete={() => null}
        onNodeSelect={onSelect}
        {...node}
        {...baseNodeDefaults}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText("My Node"));
    expect(onSelect).toHaveBeenCalledWith(node);
  });

  it("calls onNodeSelect with null if node not found", async () => {
    const onSelect = vi.fn();
    render(
      <BaseNode
        nodes={[]}
        onNodeDelete={() => null}
        onNodeSelect={onSelect}
        {...node}
        {...baseNodeDefaults}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText("My Node"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("applies styles when selected", () => {
    render(
      <BaseNode
        nodes={[node]}
        onNodeDelete={() => null}
        {...node}
        {...baseNodeDefaults}
        selected
      />,
    );

    const wrapper = screen.getByTestId("node-card");
    expect(wrapper).toHaveClass("ring-2");
    expect(wrapper).toHaveClass("ring-jii-dark-green");
    expect(wrapper).toHaveStyle({ borderColor: "#005e5e" });
  });

  it("applies styles when dragging", () => {
    render(
      <BaseNode
        nodes={[node]}
        onNodeDelete={() => null}
        {...node}
        {...baseNodeDefaults}
        dragging
      />,
    );

    const wrapper = screen.getByTestId("node-card");
    expect(wrapper).toHaveClass("ring-2");
    expect(wrapper).toHaveClass("ring-jii-dark-green");
    expect(wrapper).toHaveStyle({ borderColor: "#005e5e" });
  });
});
