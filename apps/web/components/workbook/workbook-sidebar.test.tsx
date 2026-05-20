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

  it("shows a Required asterisk next to required question rows", () => {
    const required = createQuestionCell({
      id: "q-required",
      name: "consent",
      question: { kind: "yes_no", text: "Consent?", required: true },
    });
    render(<WorkbookSidebar cells={[required]} onCellClick={onCellClick} />);
    // aria-label comes from the i18n "workbooks.required" key.
    expect(screen.getByLabelText("workbooks.required")).toBeInTheDocument();
  });

  it("makes the whole card the drag source when onReorder is provided", () => {
    const onReorder = vi.fn();
    render(
      <WorkbookSidebar
        cells={[markdownCell, protocolCell]}
        onCellClick={onCellClick}
        onReorder={onReorder}
      />,
    );

    // The outer row button carries `draggable=true` so the user can grab
    // anywhere on the card, not just the GripVertical icon.
    const rows = screen.getAllByRole("button").filter((el) => el.getAttribute("draggable"));
    expect(rows.length).toBeGreaterThanOrEqual(2);
    rows.forEach((row) => expect(row).toHaveAttribute("draggable", "true"));
  });
});
