import { render, screen } from "@/test/test-utils";
import { Position } from "@xyflow/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { NodeContent } from "../node-content";

vi.mock("../node-config", () => ({
  nodeTypeColorMap: {
    QUESTION: { border: "border-red-500", bg: "bg-red-50", icon: <span data-testid="icon" /> },
    INSTRUCTION: { border: "border-blue-500", bg: "bg-blue-50", icon: <span data-testid="icon" /> },
    MEASUREMENT: {
      border: "border-green-500",
      bg: "bg-green-50",
      icon: <span data-testid="icon" />,
    },
    ANALYSIS: {
      border: "border-yellow-500",
      bg: "bg-yellow-50",
      icon: <span data-testid="icon" />,
    },
  },
}));

vi.mock("../node-handles", () => ({
  NodeHandles: () => <div data-testid="node-handles" />,
}));

const baseProps = {
  nodeType: "QUESTION" as const,
  hasInput: true,
  hasOutput: true,
  inputPosition: Position.Left,
  outputPosition: Position.Right,
};

describe("NodeContent", () => {
  it("renders the title when provided", () => {
    render(<NodeContent {...baseProps} title="Plot number" />);
    expect(screen.getByText("Plot number")).toBeInTheDocument();
    expect(screen.queryByText("flow.untitledNode")).not.toBeInTheDocument();
  });

  it("renders the untitled placeholder when title is empty", () => {
    render(<NodeContent {...baseProps} title="" />);
    expect(screen.getByText("flow.untitledNode")).toBeInTheDocument();
  });

  it("shows the start indicator when isStartNode is true", () => {
    render(<NodeContent {...baseProps} title="Q" isStartNode />);
    expect(screen.getByText("start")).toBeInTheDocument();
  });

  it("does not show the start indicator by default", () => {
    render(<NodeContent {...baseProps} title="Q" />);
    expect(screen.queryByText("start")).not.toBeInTheDocument();
  });
});
