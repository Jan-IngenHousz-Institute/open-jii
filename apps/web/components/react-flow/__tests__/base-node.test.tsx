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

// --- mock node-content ---
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
    QUESTION: { border: "border-red-500" },
    INSTRUCTION: { border: "border-blue-500" },
    MEASUREMENT: { border: "border-green-500" },
    ANALYSIS: { border: "border-yellow-500" },
    default: { border: "border-gray-500" },
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
    const { container } = render(
      <BaseNode
        nodes={[node]}
        onNodeDelete={() => null}
        {...node}
        {...baseNodeDefaults}
        selected
      />,
    );

    const wrapper = container.querySelector(".text-card-foreground");
    expect(wrapper).toHaveClass("!border-jii-dark-green");
    expect(wrapper).toHaveClass("!bg-jii-dark-green/10");
    expect(wrapper?.className).toMatch(/border/);
  });

  it("applies styles when dragging", () => {
    const { container } = render(
      <BaseNode
        nodes={[node]}
        onNodeDelete={() => null}
        {...node}
        {...baseNodeDefaults}
        dragging
      />,
    );

    const wrapper = container.querySelector(".text-card-foreground");
    expect(wrapper).toHaveClass("!border-jii-dark-green");
    expect(wrapper).toHaveClass("!bg-jii-dark-green/10");
    expect(wrapper?.className).toMatch(/border/);
  });
});
