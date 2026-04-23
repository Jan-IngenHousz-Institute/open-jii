import {
  createMarkdownCell,
  createOutputCell,
  createProtocolCell,
  createQuestionCell,
} from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { WorkbookCell } from "@repo/api";

import { FlowchartSidebar } from "./flowchart-sidebar";

const markdownCell = createMarkdownCell({ id: "md-1", content: "Hello" });
const protocolCell = createProtocolCell({
  id: "proto-1",
  payload: { protocolId: "p1", version: 1, name: "Test Protocol" },
});
const outputCell = createOutputCell({ id: "out-1", producedBy: "proto-1" });
const questionCell = createQuestionCell({
  id: "q-1",
  question: { kind: "open_ended", text: "What?", required: false },
});

describe("FlowchartSidebar", () => {
  const onToggle = vi.fn();
  const onCellClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders flow nodes for non-output cells", () => {
    render(
      <FlowchartSidebar
        cells={[markdownCell, protocolCell, outputCell, questionCell]}
        isOpen={true}
        onToggle={onToggle}
        onCellClick={onCellClick}
      />,
    );
    expect(screen.getByText("Markdown 1")).toBeInTheDocument();
    expect(screen.getByText("Protocol 1")).toBeInTheDocument();
    expect(screen.getByText("Question 1")).toBeInTheDocument();
    // Output cells are skipped in flow
    expect(screen.queryByText("Output 1")).not.toBeInTheDocument();
  });

  it("shows Flow heading when open", () => {
    render(
      <FlowchartSidebar
        cells={[markdownCell]}
        isOpen={true}
        onToggle={onToggle}
        onCellClick={onCellClick}
      />,
    );
    expect(screen.getByText("Flow")).toBeInTheDocument();
  });

  it("calls onCellClick when a node is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FlowchartSidebar
        cells={[markdownCell]}
        isOpen={true}
        onToggle={onToggle}
        onCellClick={onCellClick}
      />,
    );
    await user.click(screen.getByText("Markdown 1"));
    expect(onCellClick).toHaveBeenCalledWith("md-1");
  });

  it("numbers cells by type", () => {
    const cells: WorkbookCell[] = [markdownCell, { ...markdownCell, id: "md-2" }, protocolCell];
    render(
      <FlowchartSidebar
        cells={cells}
        isOpen={true}
        onToggle={onToggle}
        onCellClick={onCellClick}
      />,
    );
    expect(screen.getByText("Markdown 1")).toBeInTheDocument();
    expect(screen.getByText("Markdown 2")).toBeInTheDocument();
    expect(screen.getByText("Protocol 1")).toBeInTheDocument();
  });

  it("renders collapse button when closed", () => {
    render(
      <FlowchartSidebar
        cells={[markdownCell]}
        isOpen={false}
        onToggle={onToggle}
        onCellClick={onCellClick}
      />,
    );
    // When closed, shows a small toggle button, no Flow heading
    expect(screen.queryByText("Flow")).not.toBeInTheDocument();
  });
});
