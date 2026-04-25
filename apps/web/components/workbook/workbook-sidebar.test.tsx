import { createMarkdownCell, createProtocolCell, createQuestionCell } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import { WorkbookSidebar } from "./workbook-sidebar";

const markdownCell = createMarkdownCell({ id: "md-1", content: "<p>Hello world</p>" });
const questionCell = createQuestionCell({
  id: "q-1",
  question: { kind: "open_ended", text: "What?", required: false },
});
const protocolCell = createProtocolCell({
  id: "proto-1",
  payload: { protocolId: "p1", version: 1, name: "My Protocol" },
});

describe("WorkbookSidebar", () => {
  const onCellClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders cell list with type labels", () => {
    render(
      <WorkbookSidebar
        cells={[markdownCell, questionCell, protocolCell]}
        onCellClick={onCellClick}
      />,
    );
    expect(screen.getByText("Markdown")).toBeInTheDocument();
    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(screen.getByText("Protocol")).toBeInTheDocument();
  });

  it("shows cell subtitles", () => {
    render(
      <WorkbookSidebar
        cells={[markdownCell, questionCell, protocolCell]}
        onCellClick={onCellClick}
      />,
    );
    // Markdown subtitle is stripped HTML content
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    // Question subtitle is the question text
    expect(screen.getByText("What?")).toBeInTheDocument();
    // Protocol subtitle is the protocol name
    expect(screen.getByText("My Protocol")).toBeInTheDocument();
  });

  it("calls onCellClick when a cell is clicked", async () => {
    const user = userEvent.setup();
    render(<WorkbookSidebar cells={[markdownCell]} onCellClick={onCellClick} />);
    await user.click(screen.getByText("Markdown"));
    expect(onCellClick).toHaveBeenCalledWith("md-1");
  });

  it("shows empty markdown subtitle as 'Empty'", () => {
    const emptyMd: WorkbookCell = { ...markdownCell, content: "" };
    render(<WorkbookSidebar cells={[emptyMd]} onCellClick={onCellClick} />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });
});
