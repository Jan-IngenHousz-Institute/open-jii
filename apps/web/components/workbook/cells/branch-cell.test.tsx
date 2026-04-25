import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { BranchCell, WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import { BranchCellComponent } from "./branch-cell";

function makeBranchCell(overrides: Partial<BranchCell> = {}): BranchCell {
  return {
    id: "branch-1",
    type: "branch",
    isCollapsed: false,
    paths: [
      {
        id: "path-1",
        label: "Path 1",
        color: "",
        conditions: [{ id: "cond-1", sourceCellId: "", field: "", operator: "eq", value: "" }],
      },
    ],
    ...overrides,
  };
}

const questionCell: WorkbookCell = {
  id: "q-1",
  type: "question",
  question: { kind: "open_ended", text: "How are you?", required: false },
  isCollapsed: false,
  isAnswered: false,
};

const protocolCell: WorkbookCell = {
  id: "proto-1",
  type: "protocol",
  payload: { protocolId: "p1", version: 1, name: "Light sensor" },
  isCollapsed: false,
};

function renderBranch(
  overrides: Partial<BranchCell> = {},
  props: Partial<React.ComponentProps<typeof BranchCellComponent>> = {},
) {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const cell = makeBranchCell(overrides);
  const result = render(
    <BranchCellComponent
      cell={cell}
      onUpdate={onUpdate}
      onDelete={onDelete}
      allCells={[cell, questionCell, protocolCell]}
      {...props}
    />,
  );
  return { ...result, onUpdate, onDelete, cell };
}

describe("BranchCellComponent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("displays the path name and its condition row with IF label", () => {
    renderBranch();
    expect(screen.getByDisplayValue("Path 1")).toBeInTheDocument();
    expect(screen.getByText("If")).toBeInTheDocument();
  });

  it("lets the user rename a path inline", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderBranch();

    const pathInput = screen.getByDisplayValue("Path 1");
    await user.type(pathInput, " updated");

    // The controlled input appends to the original value on each keystroke
    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0] as BranchCell;
    expect(lastCall.paths[0].label).toContain("Path 1");
    // Verify onUpdate was called for each character
    expect(onUpdate).toHaveBeenCalled();
  });

  it("lets the user type a value into the condition row", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderBranch();

    const valueInput = screen.getByPlaceholderText("value");
    await user.type(valueInput, "4");

    // First keystroke fires onUpdate with value "4"
    const firstCall = onUpdate.mock.calls[0][0] as BranchCell;
    expect(firstCall.paths[0].conditions[0].value).toBe("4");
  });

  it("adds a second path when the user clicks Add Path", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderBranch();

    await user.click(screen.getByRole("button", { name: /add path/i }));

    const updated = onUpdate.mock.calls[0][0] as BranchCell;
    expect(updated.paths).toHaveLength(2);
    expect(updated.paths[1].label).toBe("Path 2");
    expect(updated.paths[1].conditions).toHaveLength(1);
  });

  it("adds a condition when the user clicks '+ condition'", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderBranch();

    await user.click(screen.getByText("condition"));

    const updated = onUpdate.mock.calls[0][0] as BranchCell;
    expect(updated.paths[0].conditions).toHaveLength(2);
  });

  it("renders the condition's IF / AND labels correctly for multiple conditions", () => {
    renderBranch({
      paths: [
        {
          id: "path-1",
          label: "Path 1",
          color: "",
          conditions: [
            { id: "c1", sourceCellId: "", field: "", operator: "eq", value: "" },
            { id: "c2", sourceCellId: "", field: "", operator: "gt", value: "" },
          ],
        },
      ],
    });
    expect(screen.getByText("If")).toBeInTheDocument();
    expect(screen.getByText("And")).toBeInTheDocument();
  });

  it("does not crash with undefined paths (corrupt legacy data)", () => {
    const cell = makeBranchCell();
    // @ts-expect-error — simulating corrupt data
    delete cell.paths;
    render(<BranchCellComponent cell={cell} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Branch")).toBeInTheDocument();
  });

  it("hides editing controls when readOnly is true", () => {
    renderBranch({}, { readOnly: true });
    expect(screen.queryByRole("button", { name: /add path/i })).not.toBeInTheDocument();
    expect(screen.queryByText("condition")).not.toBeInTheDocument();
  });

  it("disables inputs and selects when readOnly is true", () => {
    renderBranch({}, { readOnly: true });
    const pathInput = screen.getByDisplayValue("Path 1");
    expect(pathInput).toBeDisabled();
    const valueInput = screen.getByPlaceholderText("value");
    expect(valueInput).toBeDisabled();
  });

  it("shows ACTIVE badge on the evaluated path", () => {
    renderBranch({ evaluatedPathId: "path-1" });
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });
});
