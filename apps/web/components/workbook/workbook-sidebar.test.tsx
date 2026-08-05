import {
  createBranchCell,
  createCommandCell,
  createMarkdownCell,
  createProtocolCell,
  createQuestionCell,
} from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import deWorkbook from "@repo/i18n/locales/de-DE/workbook.json";
import enWorkbook from "@repo/i18n/locales/en-US/workbook.json";
import nlWorkbook from "@repo/i18n/locales/nl-NL/workbook.json";

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

  it("shows the command content as the command cell subtitle", () => {
    const commandCell = createCommandCell({
      id: "cmd-1",
      payload: { format: "string", content: "battery" },
    });
    render(<WorkbookSidebar cells={[commandCell]} onCellClick={onCellClick} />);
    expect(screen.getByText("battery")).toBeInTheDocument();
  });

  it("falls back to the command format when the command has no name or content", () => {
    const commandCell = createCommandCell({
      id: "cmd-2",
      payload: { format: "yaml", content: "" },
    });
    render(<WorkbookSidebar cells={[commandCell]} onCellClick={onCellClick} />);
    expect(screen.getByText("yaml")).toBeInTheDocument();
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

  it("lists dangling branch references in Problems and selects the branch", async () => {
    const user = userEvent.setup();
    const branch = createBranchCell({
      id: "branch-1",
      paths: [
        {
          id: "path-1",
          label: "Broken",
          color: "#005E5E",
          conditions: [
            {
              id: "cond-1",
              sourceCellId: questionCell.id,
              field: "answer",
              operator: "eq",
              value: "yes",
            },
          ],
          gotoCellId: "deleted-target",
        },
      ],
    });
    render(<WorkbookSidebar cells={[questionCell, branch]} onCellClick={onCellClick} />);

    expect(screen.getByRole("region", { name: "workbooks.problems.title" })).toHaveTextContent(
      "workbooks.problems.issue.danglingBranchGoto",
    );
    await user.click(screen.getByText("workbooks.problems.issue.danglingBranchGoto"));
    expect(onCellClick).toHaveBeenCalledWith("branch-1");
  });

  it("shows an empty Problems state for a structurally valid workbook", () => {
    render(<WorkbookSidebar cells={[markdownCell]} onCellClick={onCellClick} />);
    expect(screen.getByRole("region", { name: "workbooks.problems.title" })).toHaveTextContent(
      "workbooks.problems.none",
    );
  });

  it("lists an unreachable cell warning and selects the unreachable cell", async () => {
    const user = userEvent.setup();
    const goto = createBranchCell({
      id: "goto",
      paths: [
        {
          id: "goto-path",
          label: "Go to",
          color: "#005E5E",
          conditions: [],
          gotoCellId: "target",
        },
      ],
      defaultPathId: "goto-path",
    });
    const orphan = createMarkdownCell({ id: "orphan", content: "Skipped" });
    const target = createMarkdownCell({ id: "target", content: "Target" });
    render(<WorkbookSidebar cells={[goto, orphan, target]} onCellClick={onCellClick} />);

    expect(screen.getByText("workbooks.problems.issue.unreachableCell")).toBeInTheDocument();
    await user.click(screen.getByText("workbooks.problems.issue.unreachableCell"));
    expect(onCellClick).toHaveBeenCalledWith("orphan");
  });

  it("provides EN, NL, and DE Problems translations for every structural branch issue", () => {
    const issueKeys = [
      "unreachableCell",
      "backwardGotoLoop",
      "branchNoDefault",
      "duplicateBranchPathId",
      "duplicatePathConditions",
    ] as const;

    for (const locale of [enWorkbook, nlWorkbook, deWorkbook]) {
      expect(locale.workbooks.problems.title).toBeTruthy();
      expect(locale.workbooks.problems.none).toBeTruthy();
      for (const key of issueKeys) {
        expect(locale.workbooks.problems.issue[key]).toBeTruthy();
      }
    }
  });
});
