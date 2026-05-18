import { createMarkdownCell, createProtocolCell, createQuestionCell } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import { WorkbookSidebar } from "./workbook-sidebar";

const markdownCell = createMarkdownCell({ id: "md-1", content: "<p>Hello world</p>" });
const questionCell = createQuestionCell({
  id: "q-1",
  name: "soil_moisture",
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

  it("renders cell list with the type label as title (question shows 'Question' + text below)", () => {
    render(
      <WorkbookSidebar
        cells={[markdownCell, questionCell, protocolCell]}
        onCellClick={onCellClick}
      />,
    );
    expect(screen.getByText("Markdown")).toBeInTheDocument();
    // For question cells the title is now the literal type label "Question"
    // (in pink) and the question text shows in the subtitle row.
    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(screen.queryByText("soil_moisture")).not.toBeInTheDocument();
    expect(screen.getByText("Protocol")).toBeInTheDocument();
  });

  it("shows cell subtitles", () => {
    render(
      <WorkbookSidebar
        cells={[markdownCell, questionCell, protocolCell]}
        onCellClick={onCellClick}
      />,
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.getByText("What?")).toBeInTheDocument();
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
