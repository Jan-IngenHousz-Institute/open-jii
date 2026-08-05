import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { BranchCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { validateBranchCell } from "@repo/api/transforms/evaluate-branch";

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
    defaultPathId: "path-1",
    ...overrides,
  };
}

const questionCell: WorkbookCell = {
  id: "q-1",
  type: "question",
  name: "q1",
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

const commandCell: WorkbookCell = {
  id: "cmd-1",
  type: "command",
  payload: { format: "string", content: "battery" },
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
  it("caps path labels at the workbook schema bound", async () => {
    const user = userEvent.setup();
    renderBranch();
    const input = screen.getByDisplayValue<HTMLInputElement>("Path 1");

    expect(input).toHaveAttribute("maxlength", "64");
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}");
    await user.type(input, "x".repeat(65));

    expect(input.value.length).toBeLessThanOrEqual(64);
  });
  beforeEach(() => vi.clearAllMocks());

  it("displays the path name and its condition row with IF label", () => {
    renderBranch();
    expect(screen.getByDisplayValue("Path 1")).toBeInTheDocument();
    expect(screen.getByText("If")).toBeInTheDocument();
  });

  it("shows branch configuration errors inline before a run", () => {
    renderBranch();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("no source cell selected");
    expect(alert).toHaveTextContent("no field selected");
    expect(alert).toHaveTextContent("no value specified");
  });

  it("presents intentional default-less fall-through as a warning, not an error", () => {
    renderBranch({
      defaultPathId: undefined,
      paths: [
        {
          id: "path-1",
          label: "Path 1",
          color: "",
          conditions: [
            {
              id: "cond-1",
              sourceCellId: questionCell.id,
              field: "answer",
              operator: "eq",
              value: "yes",
            },
          ],
        },
      ],
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "workbooks.problems.issue.branchNoDefault",
    );
  });

  it("lets the user rename a path inline", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderBranch();

    const pathInput = screen.getByDisplayValue("Path 1");
    await user.type(pathInput, " updated");

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0] as BranchCell;
    expect(lastCall.paths[0].label).toContain("Path 1");
    expect(onUpdate).toHaveBeenCalled();
  });

  it("persists an empty path label because the workbook schema permits it", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderBranch();
    const input = screen.getByDisplayValue("Path 1");

    await user.clear(input);

    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        paths: [expect.objectContaining({ id: "path-1", label: "" })],
      }),
    );
  });

  it("updates only the selected path when duplicate ids are being repaired", async () => {
    const user = userEvent.setup();
    const duplicatePaths: BranchCell["paths"] = [
      {
        id: "duplicate",
        label: "First",
        color: "",
        conditions: [{ id: "c1", sourceCellId: "", field: "", operator: "eq", value: "" }],
      },
      {
        id: "duplicate",
        label: "Second",
        color: "",
        conditions: [{ id: "c2", sourceCellId: "", field: "", operator: "eq", value: "" }],
      },
    ];
    const { onUpdate } = renderBranch({
      paths: duplicatePaths,
      defaultPathId: "duplicate",
    });

    await user.type(screen.getByDisplayValue("Second"), "!");

    const updated = onUpdate.mock.calls.at(-1)?.[0] as BranchCell;
    expect(updated.paths[0].label).toBe("First");
    expect(updated.paths[1].label).toContain("Second");
    expect(updated.paths[1].label).toContain("!");
  });

  it("removes only the selected duplicate path and preserves the now-resolved default", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderBranch({
      paths: [
        {
          id: "duplicate",
          label: "First",
          color: "",
          conditions: [{ id: "c1", sourceCellId: "", field: "", operator: "eq", value: "" }],
        },
        {
          id: "duplicate",
          label: "Second",
          color: "",
          conditions: [{ id: "c2", sourceCellId: "", field: "", operator: "eq", value: "" }],
        },
      ],
      defaultPathId: "duplicate",
    });

    await user.click(screen.getByRole("button", { name: "Remove Second" }));

    const updated = onUpdate.mock.calls[0][0] as BranchCell;
    expect(updated.paths).toHaveLength(1);
    expect(updated.paths[0].label).toBe("First");
    expect(updated.defaultPathId).toBe("duplicate");
  });

  it("lets the user type a value into the condition row", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderBranch();

    const valueInput = screen.getByPlaceholderText("value");
    await user.type(valueInput, "4");

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
    expect(updated.paths[1].color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(updated.paths[1].color).not.toBe(updated.paths[0].color);
  });

  it("sets Otherwise to one exact authored path without producing a missing default", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderBranch({
      paths: [
        makeBranchCell().paths[0],
        {
          id: "path-2",
          label: "Path 2",
          color: "#005E5E",
          conditions: [
            {
              id: "cond-2",
              sourceCellId: "q-1",
              field: "answer",
              operator: "eq",
              value: "yes",
            },
          ],
        },
      ],
    });

    await user.click(screen.getByRole("combobox", { name: "Otherwise path" }));
    await user.click(screen.getByRole("option", { name: "Path 2" }));
    const updated = onUpdate.mock.calls[0][0] as BranchCell;
    expect(updated.defaultPathId).toBe("path-2");
    expect(validateBranchCell(updated).some((error) => error.includes("Otherwise"))).toBe(false);
  });

  it("preserves a missing Otherwise path as a repairable option", async () => {
    const user = userEvent.setup();
    renderBranch({ defaultPathId: "deleted-path" });

    await user.click(screen.getByRole("combobox", { name: "Otherwise path" }));

    expect(screen.getByRole("option", { name: "Missing path (deleted-path)" })).toBeInTheDocument();
  });

  it("preserves an ambiguous Otherwise path without collapsing duplicate options", async () => {
    const user = userEvent.setup();
    renderBranch({
      paths: [
        {
          id: "duplicate",
          label: "First",
          color: "",
          conditions: [{ id: "c1", sourceCellId: "", field: "", operator: "eq", value: "" }],
        },
        {
          id: "duplicate",
          label: "Second",
          color: "",
          conditions: [{ id: "c2", sourceCellId: "", field: "", operator: "eq", value: "" }],
        },
      ],
      defaultPathId: "duplicate",
    });

    await user.click(screen.getByRole("combobox", { name: "Otherwise path" }));

    expect(screen.getByRole("option", { name: "Ambiguous path (duplicate)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "First" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Second" })).toBeInTheDocument();
  });

  it("adds a condition when the user clicks '+ condition'", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderBranch();

    await user.click(screen.getByText("condition"));

    const updated = onUpdate.mock.calls[0][0] as BranchCell;
    expect(updated.paths[0].conditions).toHaveLength(2);
  });

  it("labels a command cell in the source-cell dropdown", async () => {
    const user = userEvent.setup();
    const cell = makeBranchCell();
    render(
      <BranchCellComponent
        cell={cell}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        allCells={[commandCell, cell]}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Source cell" }));

    expect(await screen.findByText("Command (battery)")).toBeInTheDocument();
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
    // @ts-expect-error simulating corrupt data
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

  it("leaves an ambiguous duplicate evaluated path unmarked", () => {
    renderBranch({
      paths: [
        {
          id: "duplicate",
          label: "First",
          color: "",
          conditions: [{ id: "c1", sourceCellId: "", field: "", operator: "eq", value: "" }],
        },
        {
          id: "duplicate",
          label: "Second",
          color: "",
          conditions: [{ id: "c2", sourceCellId: "", field: "", operator: "eq", value: "" }],
        },
      ],
      evaluatedPathId: "duplicate",
    });

    expect(screen.queryByText("ACTIVE")).not.toBeInTheDocument();
  });

  it("renders a conditionless default path as a compact Go to card", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderBranch({
      paths: [
        {
          id: "goto-path",
          label: "Go to",
          color: "#005E5E",
          conditions: [],
          gotoCellId: questionCell.id,
        },
      ],
      defaultPathId: "goto-path",
    });

    expect(screen.getByText("Go to")).toBeInTheDocument();
    expect(screen.queryByText("If")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Go to target" })).toHaveTextContent(
      "Q: How are you?",
    );

    await user.click(screen.getByRole("button", { name: "Convert to branch" }));
    const updated = onUpdate.mock.calls[0][0] as BranchCell;
    expect(updated.paths[0].gotoCellId).toBe(questionCell.id);
    expect(updated.paths[0].conditions).toHaveLength(1);
  });

  it("turns a one-path branch back into Go to without losing its target", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderBranch({
      paths: [
        {
          id: "path-1",
          label: "Path 1",
          color: "#005E5E",
          conditions: [{ id: "cond-1", sourceCellId: "", field: "", operator: "eq", value: "" }],
          gotoCellId: questionCell.id,
        },
      ],
      defaultPathId: "path-1",
    });

    await user.click(screen.getByRole("button", { name: "Remove condition" }));

    const updated = onUpdate.mock.calls[0][0] as BranchCell;
    expect(updated.defaultPathId).toBe("path-1");
    expect(updated.paths[0].gotoCellId).toBe(questionCell.id);
    expect(updated.paths[0].conditions).toEqual([]);
  });

  it("keeps a missing Go to target visible so it can be repaired", async () => {
    const user = userEvent.setup();
    renderBranch({
      paths: [
        {
          id: "goto-path",
          label: "Go to",
          color: "#005E5E",
          conditions: [],
          gotoCellId: "deleted-cell",
        },
      ],
      defaultPathId: "goto-path",
    });

    await user.click(screen.getByRole("combobox", { name: "Go to target" }));
    expect(screen.getByRole("option", { name: "Missing cell (deleted-cell)" })).toBeInTheDocument();
  });

  it("keeps missing condition sources and branch targets visible for repair", async () => {
    const user = userEvent.setup();
    renderBranch({
      paths: [
        {
          id: "path-1",
          label: "Broken",
          color: "#005E5E",
          conditions: [
            {
              id: "cond-1",
              sourceCellId: "deleted-source",
              field: "answer",
              operator: "eq",
              value: "yes",
            },
          ],
          gotoCellId: "deleted-target",
        },
      ],
    });

    await user.click(screen.getByRole("combobox", { name: "Source cell" }));
    expect(
      screen.getByRole("option", { name: "Missing cell (deleted-source)" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("combobox", { name: /jump to cell/i }));
    expect(
      screen.getByRole("option", { name: "Missing cell (deleted-target)" }),
    ).toBeInTheDocument();
  });
});
