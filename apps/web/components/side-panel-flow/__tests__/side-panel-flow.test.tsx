// apps/web/components/__tests__/experiment-side-panel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Edge, Node } from "@xyflow/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ExperimentSidePanel } from "../side-panel-flow";

interface QuestionSpec {
  answerType: string;
  required: boolean;
  validationMessage?: string;
}

// ---------- Mocks ----------
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) =>
      ({
        "sidePanelFlow.nodePanel": "Panel",
        "sidePanelFlow.label": "Label",
        "sidePanelFlow.labelPlaceholder": "Enter node label...",
        "sidePanelFlow.nodeProperties": "Node properties",
        "sidePanelFlow.startNode": "Start node",
        "sidePanelFlow.startNodeLimit": "Only one start node allowed",
        "flow.questionTooltip.title": "Data Column Name",
        "flow.questionTooltip.description":
          "This label will become a column in your data analysis:",
        "flow.questionTooltip.defaultColumnName": "question_name",
      })[k] ?? k,
  }),
}));

// Stub child panels so we can trigger onChange easily
vi.mock("../instruction-panel", () => ({
  InstructionPanel: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <div>
      <span>InstructionPanel</span>
      <div data-testid="instr-value">{value}</div>
      <button type="button" onClick={() => onChange("NEW_INSTRUCTION")} disabled={disabled}>
        Apply Instruction Change
      </button>
    </div>
  ),
}));

vi.mock("../question-panel", () => ({
  QuestionPanel: ({
    stepSpecification,
    onChange,
    disabled,
  }: {
    stepSpecification: unknown;
    onChange: (spec: unknown) => void;
    disabled?: boolean;
  }) => (
    <div>
      <span>QuestionPanel</span>
      <div data-testid="qp-spec">{JSON.stringify(stepSpecification)}</div>
      <button
        type="button"
        onClick={() =>
          onChange({
            ...(typeof stepSpecification === "object" && stepSpecification !== null
              ? stepSpecification
              : {}),
            answerType: "SELECT",
            options: ["A", "B"],
          })
        }
        disabled={disabled}
      >
        Apply Question Change
      </button>
    </div>
  ),
}));

vi.mock("../measurement-panel", () => ({
  MeasurementPanel: ({
    selectedProtocolId,
    onChange,
    disabled,
  }: {
    selectedProtocolId: string;
    onChange: (id: string) => void;
    disabled?: boolean;
  }) => (
    <div>
      <span>MeasurementPanel</span>
      <div data-testid="mp-protocol">{selectedProtocolId}</div>
      <button type="button" onClick={() => onChange("proto-2")} disabled={disabled}>
        Apply Measurement Change
      </button>
    </div>
  ),
}));

vi.mock("../analysis-panel", () => ({
  AnalysisPanel: ({
    selectedMacroId,
    onChange,
    disabled,
  }: {
    selectedMacroId: string;
    onChange: (macroId: string) => void;
    disabled?: boolean;
  }) => (
    <div>
      <span>AnalysisPanel</span>
      <div data-testid="ap-macro">{selectedMacroId}</div>
      <button type="button" onClick={() => onChange("macro-updated")} disabled={disabled}>
        Apply Analysis Change
      </button>
    </div>
  ),
}));

vi.mock("../edge-panel", () => {
  type EdgeId = Edge["id"];
  interface EdgeSidePanelProps {
    open: boolean;
    selectedEdge: Edge | null;
    onClose: () => void;
    onEdgeUpdate?: (edgeId: EdgeId, updates: Partial<Edge>) => void;
    onEdgeDelete?: (edgeId: EdgeId) => void;
    isDisabled?: boolean;
  }

  const EdgeSidePanel = ({
    open,
    selectedEdge,
    onClose,
    onEdgeUpdate,
    onEdgeDelete,
    isDisabled = false,
  }: EdgeSidePanelProps) =>
    open ? (
      <div data-testid="edge-panel">
        <span>EdgePanel</span>
        <div data-testid="edge-id">{selectedEdge?.id ?? ""}</div>

        <button
          type="button"
          onClick={() => {
            if (!selectedEdge || !onEdgeUpdate) return;
            onEdgeUpdate(selectedEdge.id, { label: "updated" });
          }}
          disabled={isDisabled || !selectedEdge}
        >
          Update Edge
        </button>

        <button
          type="button"
          onClick={() => {
            if (!selectedEdge || !onEdgeDelete) return;
            onEdgeDelete(selectedEdge.id);
          }}
          disabled={isDisabled || !selectedEdge}
        >
          Delete Edge
        </button>

        <button type="button" onClick={onClose}>
          Close Edge Panel
        </button>
      </div>
    ) : null;

  return { EdgeSidePanel };
});

// ---------- Helpers ----------
type NodeData = Record<string, unknown>;
const makeNode = (id: string, data: NodeData = {}): Node => ({
  id,
  position: { x: 0, y: 0 },
  data,
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof ExperimentSidePanel>> = {}) {
  const defaultNode = makeNode("n1", {
    isStartNode: false,
    isEndNode: false,
    description: "",
    stepSpecification: undefined,
  });

  const props: React.ComponentProps<typeof ExperimentSidePanel> = {
    open: true,
    selectedNode: defaultNode,
    nodeType: "QUESTION",
    nodeTitle: "My Node",
    onClose: vi.fn(),
    onTitleChange: vi.fn(),
    onNodeDataChange: vi.fn(),
    selectedEdge: null,
    onEdgeUpdate: vi.fn(),
    onEdgeDelete: vi.fn(),
    nodes: [defaultNode],
    isDisabled: false,
    ...overrides,
  };

  const utils = render(<ExperimentSidePanel {...props} />);
  return { ...utils, props };
}

// ---------- Tests ----------
describe("<ExperimentSidePanel />", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows header with capitalized node type and label input", () => {
    renderPanel({ nodeType: "INSTRUCTION", nodeTitle: "Hello" });
    expect(screen.queryByText(/Instruction Panel$/)).toBeTruthy();

    const input = screen.getByPlaceholderText<HTMLInputElement>("Enter node label...");
    expect(input.value).toBe("Hello");
  });

  it("calls onClose when clicking backdrop and the top-right close button", async () => {
    const { props } = renderPanel({ nodeType: "INSTRUCTION" });

    await userEvent.click(screen.getByLabelText("Close side panel backdrop"));
    expect(props.onClose).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /×/i }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("updates title via input and calls onTitleChange", async () => {
    const { props } = renderPanel({ nodeTitle: "" });

    const input = screen.getByPlaceholderText("Enter node label...");
    await userEvent.type(input, "A");

    expect(props.onTitleChange).toHaveBeenCalled();
    expect(props.onTitleChange).toHaveBeenLastCalledWith("A");
  });

  it("disables title input and prevents callback when isDisabled", async () => {
    const { props } = renderPanel({ isDisabled: true });

    const input = screen.getByPlaceholderText("Enter node label...");
    expect((input as HTMLInputElement).disabled).toBe(true);

    await userEvent.type(input, "X");
    expect(props.onTitleChange).not.toHaveBeenCalled();
  });

  it("renders Start Node toggle, respects single-start constraint, and updates node data", async () => {
    // First render: another node is already start → toggle must be disabled
    const n1 = makeNode("n1", { isStartNode: false, isEndNode: false });
    const n2 = makeNode("n2", { isStartNode: true, isEndNode: false });

    const first = renderPanel({
      selectedNode: n1,
      nodeType: "INSTRUCTION",
      nodes: [n1, n2],
    });

    const disabledCb = screen.getByRole("checkbox");
    expect((disabledCb as HTMLInputElement).disabled).toBe(true);
    await userEvent.click(disabledCb);
    expect(first.props.onNodeDataChange).not.toHaveBeenCalled();

    // Clean up the first render before the second one
    first.unmount();

    // Second render: no other start nodes → toggle enabled and fires
    const second = renderPanel({
      selectedNode: n1,
      nodeType: "INSTRUCTION",
      nodes: [n1],
    });

    const enabledCb = screen.getByRole("checkbox");
    expect((enabledCb as HTMLInputElement).disabled).toBe(false);
    await userEvent.click(enabledCb);

    expect(second.props.onNodeDataChange).toHaveBeenCalledWith("n1", {
      isStartNode: true,
      isEndNode: false,
    });
  });

  it("InstructionPanel: passes description and propagates onChange via onNodeDataChange", async () => {
    const node = makeNode("ni", {
      description: "Initial",
      isStartNode: false,
      isEndNode: false,
    });

    const { props } = renderPanel({
      selectedNode: node,
      nodeType: "INSTRUCTION",
    });

    expect(screen.queryByText("InstructionPanel")).toBeTruthy();
    expect(screen.getByTestId("instr-value").textContent).toBe("Initial");

    await userEvent.click(screen.getByRole("button", { name: /Apply Instruction Change/i }));

    expect(props.onNodeDataChange).toHaveBeenCalledWith("ni", {
      ...node.data,
      description: "NEW_INSTRUCTION",
    });
  });

  it("QuestionPanel: if stepSpecification invalid, defaults to TEXT spec using nodeTitle; onChange wires back", async () => {
    const invalidNode = makeNode("nq", { stepSpecification: 42 });

    const first = renderPanel({
      selectedNode: invalidNode,
      nodeType: "QUESTION",
      nodeTitle: "Default Title",
    });

    const specStr = screen.getByTestId("qp-spec").textContent;
    const parsed = JSON.parse(specStr) as QuestionSpec;
    expect(parsed.answerType).toBe("TEXT");
    expect(parsed.required).toBe(false);
    expect(parsed.validationMessage).toBe("Default Title");

    first.unmount();

    const validNode = makeNode("nq", {
      stepSpecification: { answerType: "TEXT", required: false },
    });

    const second = renderPanel({
      selectedNode: validNode,
      nodeType: "QUESTION",
    });

    const applyBtn = screen.getByRole("button", { name: /Apply Question Change/i });
    await userEvent.click(applyBtn);

    expect(second.props.onNodeDataChange).toHaveBeenCalledWith("nq", {
      stepSpecification: { answerType: "SELECT", required: false, options: ["A", "B"] },
    });
  });

  it("MeasurementPanel: propagates protocol change via onNodeDataChange", async () => {
    const node = makeNode("nm", { protocolId: "proto-1" });

    const { props } = renderPanel({
      selectedNode: node,
      nodeType: "MEASUREMENT",
    });

    expect(screen.queryByText("MeasurementPanel")).toBeTruthy();
    expect(screen.getByTestId("mp-protocol").textContent).toBe("proto-1");

    await userEvent.click(screen.getByRole("button", { name: /Apply Measurement Change/i }));
    expect(props.onNodeDataChange).toHaveBeenCalledWith("nm", {
      ...node.data,
      protocolId: "proto-2",
    });
  });

  it("AnalysisPanel: propagates macroId change via onNodeDataChange", async () => {
    const node = makeNode("na", { macroId: "macro-original" });

    const { props } = renderPanel({
      selectedNode: node,
      nodeType: "ANALYSIS",
    });

    expect(screen.queryByText("AnalysisPanel")).toBeTruthy();
    expect(screen.getByTestId("ap-macro").textContent).toBe("macro-original");

    await userEvent.click(screen.getByRole("button", { name: /Apply Analysis Change/i }));
    expect(props.onNodeDataChange).toHaveBeenCalledWith("na", {
      ...node.data,
      macroId: "macro-updated",
    });
  });

  it("EdgeSidePanel opens when selectedEdge is provided and wires update/delete", async () => {
    const { props } = renderPanel({
      selectedEdge: { id: "e1", source: "n1", target: "n2", data: {} as Edge } as Edge,
    });

    expect(screen.queryByTestId("edge-panel")).toBeTruthy();
    expect(screen.getByTestId("edge-id").textContent).toBe("e1");

    await userEvent.click(screen.getByRole("button", { name: /Update Edge/i }));
    expect(props.onEdgeUpdate).toHaveBeenCalledWith("e1", { label: "updated" });

    await userEvent.click(screen.getByRole("button", { name: /Delete Edge/i }));
    expect(props.onEdgeDelete).toHaveBeenCalledWith("e1");

    await userEvent.click(screen.getByRole("button", { name: /Close Edge Panel/i }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("shows tooltip with column name preview for QUESTION nodes", () => {
    const { container } = renderPanel({
      nodeType: "QUESTION",
      nodeTitle: "My Question Label!",
    });

    // Check that the info icon SVG is present for QUESTION nodes
    const infoIcon = container.querySelector("svg.lucide-info");
    expect(infoIcon).toBeTruthy();
    expect(infoIcon).toHaveClass("lucide-info");

    const expectedFormattedLabel = "my_question_label";
    expect(expectedFormattedLabel).toBe("my_question_label");
  });

  it("shows info icon for QUESTION nodes with empty title", () => {
    const { container } = renderPanel({
      nodeType: "QUESTION",
      nodeTitle: "",
    });

    const infoIcon = container.querySelector("svg.lucide-info");
    expect(infoIcon).toBeTruthy();
    expect(infoIcon).toHaveClass("lucide-info");
  });

  it("does not show info icon for non-QUESTION nodes", () => {
    const { container } = renderPanel({
      nodeType: "INSTRUCTION",
      nodeTitle: "Test",
    });

    // Should not have the info icon
    const infoIcon = container.querySelector("svg.lucide-info");
    expect(infoIcon).toBeFalsy();
  });

  it("does not call callbacks when panel is disabled", async () => {
    const node = makeNode("nd", {
      description: "D",
      stepSpecification: { answerType: "TEXT", required: false },
      protocolId: "proto-x",
      measurementOption: "agg-min",
      isStartNode: false,
      isEndNode: false,
    });

    const { props } = renderPanel({
      isDisabled: true,
      selectedNode: node,
      nodeType: "QUESTION",
      selectedEdge: { id: "e2", source: "nA", target: "nB", data: {} as Edge } as Edge,
    });

    const input = screen.getByPlaceholderText("Enter node label...");
    expect((input as HTMLInputElement).disabled).toBe(true);
    await userEvent.type(input, "X");

    const qpBtn = screen.getByRole("button", { name: /Apply Question Change/i });
    expect((qpBtn as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(qpBtn);

    const upd = screen.getByRole("button", { name: /Update Edge/i });
    const del = screen.getByRole("button", { name: /Delete Edge/i });
    expect((upd as HTMLButtonElement).disabled).toBe(true);
    expect((del as HTMLButtonElement).disabled).toBe(true);

    expect(props.onTitleChange).not.toHaveBeenCalled();
    expect(props.onNodeDataChange).not.toHaveBeenCalled();
    expect(props.onEdgeUpdate).not.toHaveBeenCalled();
    expect(props.onEdgeDelete).not.toHaveBeenCalled();
  });
});
