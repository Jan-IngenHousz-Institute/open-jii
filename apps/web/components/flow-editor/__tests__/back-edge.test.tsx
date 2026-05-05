import { render, screen } from "@/test/test-utils";
import type * as xyflowReact from "@xyflow/react";
import { Position } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BackEdge } from "../back-edge";

vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual<typeof xyflowReact>("@xyflow/react");
  return {
    ...actual,
    BaseEdge: ({ path }: { path: string }) => <div data-testid="base-edge" data-path={path} />,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const baseProps = {
  id: "e1",
  source: "a",
  target: "b",
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
} satisfies Partial<EdgeProps>;

describe("BackEdge", () => {
  it("renders an SVG path that arcs below both endpoints (apex y is greatest)", () => {
    render(
      <svg>
        <BackEdge
          {...(baseProps as unknown as EdgeProps)}
          sourceX={500}
          sourceY={200}
          targetX={100}
          targetY={200}
        />
      </svg>,
    );

    const path = screen.getByTestId("base-edge").getAttribute("data-path") ?? "";
    expect(path).toContain("M 500,200");
    expect(path).toContain("100,200");

    const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    const maxY = Math.max(...numbers.filter((_, i) => i % 2 === 1));
    expect(maxY).toBeGreaterThan(200);
  });

  it("renders the label inside the edge label renderer when provided", () => {
    render(
      <svg>
        <BackEdge
          {...(baseProps as unknown as EdgeProps)}
          sourceX={400}
          sourceY={100}
          targetX={50}
          targetY={100}
          label="Loop back"
        />
      </svg>,
    );

    expect(screen.getByText("Loop back")).toBeInTheDocument();
  });

  it("omits the label when none is provided", () => {
    render(
      <svg>
        <BackEdge
          {...(baseProps as unknown as EdgeProps)}
          sourceX={400}
          sourceY={100}
          targetX={50}
          targetY={100}
        />
      </svg>,
    );

    expect(screen.queryByRole("paragraph")).toBeNull();
    expect(screen.getByTestId("base-edge")).toBeInTheDocument();
  });
});
