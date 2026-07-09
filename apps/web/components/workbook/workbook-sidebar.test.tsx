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

  it("shows the question's name as its title (icon + color signal the type, not a 'Question' label)", () => {
    render(
      <WorkbookSidebar
        cells={[markdownCell, questionCell, protocolCell]}
        onCellClick={onCellClick}
      />,
    );
    expect(screen.getByText("Markdown")).toBeInTheDocument();
    // Question rows now show their label (data column name) as the title; the
    // type is conveyed by the per-type icon and color instead of the word.
    expect(screen.getByText("soil_moisture")).toBeInTheDocument();
    expect(screen.queryByText("Question")).not.toBeInTheDocument();
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

    // The whole row is the dnd-kit sortable drag source (not just the grip),
    // marked with aria-roledescription="sortable" on the row button.
    const rows = screen
      .getAllByRole("button")
      .filter((el) => el.getAttribute("aria-roledescription") === "sortable");
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("does not make rows draggable when onReorder is omitted", () => {
    render(<WorkbookSidebar cells={[markdownCell, protocolCell]} onCellClick={onCellClick} />);

    const sortable = screen
      .getAllByRole("button")
      .filter((el) => el.getAttribute("aria-roledescription") === "sortable");
    expect(sortable).toHaveLength(0);
  });
});
