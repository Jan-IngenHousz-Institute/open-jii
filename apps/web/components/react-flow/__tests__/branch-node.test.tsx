import { render, screen, userEvent } from "@/test/test-utils";
import type * as xyflowReact from "@xyflow/react";
import type { Node } from "@xyflow/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BranchNode } from "../branch-node";

vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual<typeof xyflowReact>("@xyflow/react");
  return {
    ...actual,
    Handle: ({ id, type }: { id?: string; type: string }) => (
      <div data-testid="handle" data-handle-id={id ?? ""} data-handle-type={type} />
    ),
  };
});

const baseProps = {
  type: "BRANCH" as const,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 1,
  selectable: true,
  deletable: true,
  draggable: true,
  selected: false,
  width: 260,
  height: 160,
  measured: { width: 260, height: 160 },
};

const node: Node = {
  id: "b1",
  type: "BRANCH",
  position: { x: 0, y: 0 },
  data: {},
};

const paths = [
  { id: "p1", label: "High", color: "#10B981" },
  { id: "p2", label: "Low", color: "#EF4444" },
];

describe("BranchNode", () => {
  it("renders the title and a source handle for each path", () => {
    render(
      <BranchNode
        nodes={[node]}
        onNodeDelete={() => null}
        {...node}
        {...baseProps}
        data={{ title: "Soil branch", stepSpecification: { paths } }}
      />,
    );

    expect(screen.getByText("Soil branch")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();

    const handles = screen.getAllByTestId("handle");
    expect(handles.find((h) => h.getAttribute("data-handle-type") === "target")).toBeTruthy();
    const sourceHandleIds = handles
      .filter((h) => h.getAttribute("data-handle-type") === "source")
      .map((h) => h.getAttribute("data-handle-id"));
    expect(sourceHandleIds).toEqual(expect.arrayContaining(["p1", "p2"]));
  });

  it("badges the default path", () => {
    render(
      <BranchNode
        nodes={[node]}
        onNodeDelete={() => null}
        {...node}
        {...baseProps}
        data={{ title: "Soil branch", stepSpecification: { paths, defaultPathId: "p2" } }}
      />,
    );

    expect(screen.getByText(/default/i)).toBeInTheDocument();
  });

  it("shows a placeholder when no paths are configured", () => {
    render(
      <BranchNode
        nodes={[node]}
        onNodeDelete={() => null}
        {...node}
        {...baseProps}
        data={{ title: "Empty branch", stepSpecification: { paths: [] } }}
      />,
    );

    expect(screen.getByText(/no paths configured/i)).toBeInTheDocument();
  });

  it("calls onNodeDelete when the delete button is clicked", async () => {
    const onDelete = vi.fn();
    render(
      <BranchNode
        nodes={[node]}
        onNodeDelete={onDelete}
        {...node}
        {...baseProps}
        data={{ title: "Soil branch", stepSpecification: { paths } }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /delete node/i }));
    expect(onDelete).toHaveBeenCalledWith("b1");
  });

  it("hides the delete button when isStatic", () => {
    render(
      <BranchNode
        nodes={[node]}
        onNodeDelete={() => null}
        isStatic
        {...node}
        {...baseProps}
        data={{ title: "Soil branch", stepSpecification: { paths } }}
      />,
    );

    expect(screen.queryByRole("button", { name: /delete node/i })).toBeNull();
  });

  it("calls onNodeSelect with the matching node when clicked", async () => {
    const onSelect = vi.fn();
    render(
      <BranchNode
        nodes={[node]}
        onNodeDelete={() => null}
        onNodeSelect={onSelect}
        {...node}
        {...baseProps}
        data={{ title: "Soil branch", stepSpecification: { paths } }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText("Soil branch"));
    expect(onSelect).toHaveBeenCalledWith(node);
  });
});
