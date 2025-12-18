// apps/web/components/__tests__/flow-editor.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as xyflowReact from "@xyflow/react";
import React, { createRef } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Spy on ensureOneStartNode from the real module (no full mock)
import * as nodeUtils from "../../react-flow/node-utils";
/* -------------------- Import the component AFTER mocks -------------------- */
import { FlowEditor } from "../flow-editor";
import type { FlowEditorHandle } from "../flow-editor";

// Keep React on global for JSX in some deps
globalThis.React = React;

/* -------------------- Light mocks -------------------- */

// i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// debounce hook used by some panels/components
vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: <T,>(v: T) => v,
}));

// measurement panel (avoid pulling search hooks, etc.)
vi.mock("../../side-panel-flow/measurement-panel", () => ({
  MeasurementPanel: () => null,
}));

// react-flow test double: expose count + buttons to simulate canvas events
vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual("@xyflow/react");
  const ReactFlow = ({
    nodes = [],
    edges = [],
    onConnect,
    onEdgeClick,
    onPaneClick,
    nodesDraggable,
    nodesConnectable,
  }: xyflowReact.ReactFlowProps) => (
    <div data-testid="rf">
      <div data-testid="rf-nodes-count">{nodes.length}</div>
      <div data-testid="rf-edges-count">{edges.length}</div>
      <div data-testid="rf-draggable">{String(nodesDraggable)}</div>
      <div data-testid="rf-connectable">{String(nodesConnectable)}</div>

      <button
        type="button"
        onClick={() =>
          onConnect?.({ source: "nA", target: "nB", sourceHandle: null, targetHandle: null })
        }
        aria-label="Sim Connect"
      >
        Sim Connect
      </button>

      <button
        type="button"
        onClick={() =>
          onEdgeClick?.(
            { stopPropagation: () => void 0 } as unknown as React.MouseEvent,
            edges[0] ?? { id: "e1", source: "n1", target: "n2" },
          )
        }
        aria-label="Sim Edge Click"
      >
        Sim Edge Click
      </button>

      <button type="button" onClick={(e) => onPaneClick?.(e)} aria-label="Sim Pane Click">
        Sim Pane Click
      </button>
    </div>
  );

  return { ...(actual as xyflowReact.Node), ReactFlow };
});

// legend (keep tiny)
vi.mock("../legend-flow", () => ({
  LegendFlow: ({ overlay }: { overlay?: boolean }) => (
    <div data-testid={overlay ? "legend-overlay" : "legend"} />
  ),
}));

// node-config: keep API, no styling logic
vi.mock("../react-flow/node-config", () => ({
  ALL_NODE_TYPES: ["INSTRUCTION", "QUESTION", "MEASUREMENT", "ANALYSIS"],
  getStyledEdges: (edges: xyflowReact.Edge) => edges,
}));

const ensureOneStartNodeSpy = vi
  .spyOn(nodeUtils, "ensureOneStartNode")
  .mockImplementation((nds: xyflowReact.Node[]) => nds);

// flow-utils: make getFlowData a spy for assertions; simplify helpers
const getFlowDataSpy = vi.fn((nodes: xyflowReact.Node[], edges: xyflowReact.Edge[]) => ({
  nodes: nodes.map((n) => n.id),
  edges: edges.map((e) => e.id),
}));

const toInitialFlow = (
  nodes: readonly xyflowReact.Node[],
  edges: readonly xyflowReact.Edge[],
): NonNullable<React.ComponentProps<typeof FlowEditor>["initialFlow"]> =>
  ({ nodes, edges }) as unknown as NonNullable<
    React.ComponentProps<typeof FlowEditor>["initialFlow"]
  >;

vi.mock("../react-flow/flow-utils", () => ({
  getFlowData: (...args: [xyflowReact.Node[], xyflowReact.Edge[]]) => getFlowDataSpy(...args),
  handleNodesDeleteWithReconnection: (
    _deleted: xyflowReact.Node,
    _nodes: xyflowReact.Node,
    edges: xyflowReact.Edge,
  ) => edges,
  handleNodeDrop: (_e: React.DragEvent, nodes: xyflowReact.Node[]) => ({
    newNode: {
      id: `new-${nodes.length + 1}`,
      type: "INSTRUCTION",
      data: { title: "New Node", isStartNode: false, isEndNode: false },
      position: { x: 0, y: 0 },
    },
  }),
}));

// hoist constants used inside the mock
const { defaultNodes, defaultEdges, isRFLike } = vi.hoisted(() => {
  const defaultNodes: readonly xyflowReact.Node[] = [
    {
      id: "n1",
      type: "QUESTION",
      data: {
        title: "Q1",
        isStartNode: false,
        isEndNode: false,
        stepSpecification: {},
      } as Record<string, unknown>,
      position: { x: 0, y: 0 },
    },
  ];

  const defaultEdges: readonly xyflowReact.Edge[] = [
    { id: "e1", source: "n1", target: "n2", data: { label: "E1" } },
  ];

  const isRFLike = (
    v: unknown,
  ): v is { nodes: readonly xyflowReact.Node[]; edges: readonly xyflowReact.Edge[] } =>
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as { nodes: unknown }).nodes) &&
    Array.isArray((v as { edges: unknown }).edges);

  return { defaultNodes, defaultEdges, isRFLike };
});

vi.mock("../flow-mapper", () => {
  return {
    __esModule: true as const, // helps ESM interop
    FlowMapper: {
      toReactFlow(
        flow?: { nodes: readonly xyflowReact.Node[]; edges: readonly xyflowReact.Edge[] } | null,
      ): {
        nodes: readonly xyflowReact.Node[];
        edges: readonly xyflowReact.Edge[];
      } {
        return isRFLike(flow)
          ? { nodes: flow.nodes, edges: flow.edges }
          : { nodes: defaultNodes, edges: defaultEdges };
      },

      toApiGraph(
        nodes: readonly xyflowReact.Node[],
        edges: readonly xyflowReact.Edge[],
      ): { nodes: readonly xyflowReact.Node[]; edges: readonly xyflowReact.Edge[] } {
        return { nodes, edges };
      },
    },
  };
});

/* -------------------- Helpers -------------------- */
/** Robustly read an integer from a test id */
const readCount = (testId: string): number => {
  const el = screen.getByTestId(testId);
  const n = Number.parseInt(el.textContent, 10);
  return Number.isNaN(n) ? 0 : n;
};

function getCounts(): { n: number; e: number } {
  return { n: readCount("rf-nodes-count"), e: readCount("rf-edges-count") };
}

/** Narrow to FlowEditor’s expected `initialFlow` type without `any` */
const asInitialFlow = (v: {
  nodes: readonly xyflowReact.Node[];
  edges: readonly xyflowReact.Edge[];
}): NonNullable<React.ComponentProps<typeof FlowEditor>["initialFlow"]> =>
  v as unknown as NonNullable<React.ComponentProps<typeof FlowEditor>["initialFlow"]>;

function renderEditor(
  overrides: Partial<React.ComponentProps<typeof FlowEditor>> = {},
  withRef = false,
) {
  const ref = withRef ? createRef<FlowEditorHandle>() : undefined;

  const initialFlow = {
    nodes: [
      {
        id: "n1",
        type: "QUESTION",
        data: {
          title: "My Node",
          isStartNode: false,
          isEndNode: false,
          stepSpecification: {},
        } as Record<string, unknown>,
        position: { x: 0, y: 0 },
      } satisfies xyflowReact.Node,
    ],
    edges: [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        data: { label: "init" },
      } satisfies xyflowReact.Edge,
    ],
  } satisfies { nodes: readonly xyflowReact.Node[]; edges: readonly xyflowReact.Edge[] };

  const props: React.ComponentProps<typeof FlowEditor> = {
    initialFlow: asInitialFlow(initialFlow),
    onNodeSelect: vi.fn(),
    onDirtyChange: vi.fn(),
    isDisabled: false,
    ...overrides,
  };

  const utils = render(<FlowEditor ref={ref} {...props} />);
  return { ...utils, props, ref };
}

/* -------------------- Tests -------------------- */
describe("<FlowEditor /> (stable suite)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders and getFlowData() via ref returns ids", () => {
    const { ref } = renderEditor({}, true);

    expect(screen.queryByTestId("rf")).toBeTruthy();
    const data = ref?.current?.getFlowData() as unknown;

    // Normalize to ids whether data contains strings or objects
    const toIds = (arr: unknown[]): string[] =>
      arr.map((x) =>
        typeof x === "string"
          ? x
          : typeof x === "object" &&
              x !== null &&
              "id" in x &&
              typeof (x as { id: unknown }).id === "string"
            ? (x as { id: string }).id
            : "",
      );

    const safeData =
      typeof data === "object" && data !== null && "nodes" in data && "edges" in data
        ? (data as { nodes: unknown[]; edges: unknown[] })
        : { nodes: [], edges: [] };

    expect({
      nodes: toIds(safeData.nodes),
      edges: toIds(safeData.edges),
    }).toEqual({ nodes: ["n1"], edges: ["e1"] });
  });

  it("fullscreen toggle changes aria-label", async () => {
    renderEditor();

    const btn = screen.getByRole("button", { name: /Enter fullscreen/i });
    await userEvent.click(btn);
    expect(screen.getByRole("button", { name: /Exit fullscreen/i })).toBeTruthy();
  });

  it("connect adds an edge when enabled", async () => {
    renderEditor();
    const before = getCounts();
    expect(before.e).toBe(1);

    await userEvent.click(screen.getByRole("button", { name: "Sim Connect" }));
    const after = getCounts();
    expect(after.e).toBe(2);
  });

  it("pane click is wired (no throw)", async () => {
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "Sim Pane Click" }));
  });

  it("calls onDirtyChange(true) after first change", async () => {
    const { props } = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "Sim Connect" }));
    expect(props.onDirtyChange).toHaveBeenCalledWith(true);
  });

  it("disabled mode prevents connect and disables interactivity flags", async () => {
    renderEditor({ isDisabled: true });

    const before = getCounts();
    await userEvent.click(screen.getByRole("button", { name: "Sim Connect" }));
    const after = getCounts();
    expect(after.e).toBe(before.e);

    expect(screen.getByTestId("rf-draggable").textContent).toBe("false");
    expect(screen.getByTestId("rf-connectable").textContent).toBe("false");
  });

  it("ensureOneStartNode is invoked on mount", () => {
    renderEditor();
    expect(ensureOneStartNodeSpy).toHaveBeenCalled();
  });

  it("updates nodes/edges when initialFlow prop changes", () => {
    const firstNodes: readonly xyflowReact.Node[] = [
      {
        id: "a",
        type: "INSTRUCTION",
        data: { title: "A", isStartNode: false, isEndNode: false } as Record<string, unknown>,
        position: { x: 0, y: 0 },
      },
    ];
    const firstEdges: readonly xyflowReact.Edge[] = [];

    const utils = renderEditor({
      initialFlow: toInitialFlow(firstNodes, firstEdges),
    });

    expect(getCounts()).toEqual({ n: 1, e: 0 });

    const nextNodes: readonly xyflowReact.Node[] = [
      {
        id: "b",
        type: "ANALYSIS",
        data: { title: "B", isStartNode: false, isEndNode: false } as Record<string, unknown>,
        position: { x: 0, y: 0 },
      },
      {
        id: "c",
        type: "QUESTION",
        data: {
          title: "C",
          isStartNode: false,
          isEndNode: false,
          stepSpecification: {},
        } as Record<string, unknown>,
        position: { x: 50, y: 50 },
      },
    ];
    const nextEdges: readonly xyflowReact.Edge[] = [
      {
        id: "ebc",
        source: "b",
        target: "c",
        data: { label: "bc" } as Record<string, unknown>,
      },
    ];

    utils.rerender(<FlowEditor initialFlow={toInitialFlow(nextNodes, nextEdges)} />);

    expect(getCounts()).toEqual({ n: 2, e: 1 });
  });
});
