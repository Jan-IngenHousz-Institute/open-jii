import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { Position } from "@xyflow/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import {
  toPosition,
  createNewNode,
  validateFlowNodes,
  BaseNodeWrapper,
  FlowContextProvider,
} from "../node-utils";

globalThis.React = React;

// --- mock BaseNode so we don't need full implementation
vi.mock("../base-node", () => ({
  BaseNode: (props: Node) => <div data-testid="BaseNode" data-props={JSON.stringify(props)} />,
}));

describe("toPosition", () => {
  it("maps strings correctly", () => {
    expect(toPosition("left")).toBe(Position.Left);
    expect(toPosition("RIGHT")).toBe(Position.Right);
    expect(toPosition("Top")).toBe(Position.Top);
    expect(toPosition("bottom")).toBe(Position.Bottom);
  });

  it("returns undefined for invalid or empty", () => {
    expect(toPosition(undefined)).toBeUndefined();
    expect(toPosition("nope")).toBeUndefined();
  });

  it("returns Position directly when passed enum", () => {
    expect(toPosition(Position.Left)).toBe(Position.Left);
  });
});

describe("createNewNode", () => {
  it("creates a QUESTION node with default spec", () => {
    const node = createNewNode("QUESTION", { x: 0, y: 0 });
    expect(node.type).toBe("QUESTION");
    expect(node.data.stepSpecification).toMatchObject({ kind: "open_ended", text: "" });
  });

  it("creates a MEASUREMENT node with protocol spec", () => {
    const node = createNewNode("MEASUREMENT", { x: 1, y: 2 });
    expect(node.data.stepSpecification).toHaveProperty("protocolId");
  });

  it("creates an ANALYSIS node with empty spec", () => {
    const node = createNewNode("ANALYSIS", { x: 3, y: 4 });
    expect(node.data.stepSpecification).toEqual({});
  });
});

describe("validateFlowNodes", () => {
  it("returns false for empty", () => {
    expect(validateFlowNodes([])).toBe(false);
  });

  it("validates MEASUREMENT with protocolId", () => {
    const node = createNewNode("MEASUREMENT", { x: 0, y: 0 });
    node.data.stepSpecification = { protocolId: "abc" };
    expect(validateFlowNodes([node])).toBe(true);
  });

  it("validates QUESTION with text", () => {
    const node = createNewNode("QUESTION", { x: 0, y: 0 });
    node.data.stepSpecification = { kind: "open_ended", text: "hi" };
    expect(validateFlowNodes([node])).toBe(true);
  });

  it("falls back to QUESTION title when text empty", () => {
    const node = createNewNode("QUESTION", { x: 0, y: 0 }, "Hello");
    node.data.stepSpecification = { kind: "open_ended", text: "" };
    expect(validateFlowNodes([node])).toBe(true);
  });

  it("validates INSTRUCTION with text", () => {
    const node: Node = {
      id: "1",
      type: "INSTRUCTION",
      position: { x: 0, y: 0 },
      data: { title: "", stepSpecification: { text: "Do this" } },
    };
    expect(validateFlowNodes([node])).toBe(true);
  });
});

describe("FlowContext + BaseNodeWrapper", () => {
  it("throws if BaseNodeWrapper used without provider", () => {
    const node = createNewNode("QUESTION", { x: 0, y: 0 });
    expect(() =>
      render(
        <BaseNodeWrapper
          id={node.id}
          data={node.data}
          type={node.type ?? ""}
          selected={false}
          dragging={false}
          draggable={true}
          selectable={true}
          deletable={true}
          zIndex={0}
          isConnectable={true}
          positionAbsoluteX={node.position.x}
          positionAbsoluteY={node.position.y}
        />,
      ),
    ).toThrow(/must be used within FlowContext.Provider/);
  });

  it("renders BaseNode when inside FlowContextProvider", () => {
    const node = createNewNode("QUESTION", { x: 0, y: 0 });
    render(
      <FlowContextProvider
        nodes={[node]}
        onNodeSelect={() => null}
        onNodeDelete={() => null}
        onNodeDataChange={() => null}
        isDisabled={true}
      >
        <BaseNodeWrapper
          id={node.id}
          data={node.data}
          type={node.type ?? ""}
          selected={false}
          dragging={false}
          draggable={true}
          selectable={true}
          deletable={true}
          zIndex={0}
          isConnectable={true}
          positionAbsoluteX={node.position.x}
          positionAbsoluteY={node.position.y}
        />
      </FlowContextProvider>,
    );
    expect(screen.getByTestId("BaseNode")).toBeInTheDocument();
  });
});
