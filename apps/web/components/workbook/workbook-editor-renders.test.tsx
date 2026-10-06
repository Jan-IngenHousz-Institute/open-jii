import { createMarkdownCell } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { WorkbookEditor } from "./workbook-editor";

const renders = vi.hoisted(() => new Map<string, number>());

vi.mock("./cell-renderer", () => ({
  CellRenderer: ({
    cell,
    onUpdate,
  }: {
    cell: WorkbookCell;
    onUpdate: (cell: WorkbookCell) => void;
  }) => {
    renders.set(cell.id, (renders.get(cell.id) ?? 0) + 1);
    const toggle = () => onUpdate({ ...cell, isCollapsed: !cell.isCollapsed });
    return (
      <button type="button" onClick={toggle}>
        toggle {cell.id}
      </button>
    );
  },
}));

// Owns the cells like the draft editor does, and like it hands over a new run handler each render.
function Host({ initial }: { initial: WorkbookCell[] }) {
  const [cells, setCells] = useState(initial);
  const runCell = (cellId: string) => cells.find((cell) => cell.id === cellId);

  return <WorkbookEditor cells={cells} onCellsChange={setCells} onRunCell={runCell} />;
}

describe("WorkbookEditor renders", () => {
  beforeEach(() => {
    renders.clear();
    server.mount(contract.protocols.listProtocols, { body: [] });
    server.mount(contract.macros.listMacros, { body: [] });
  });

  it("re-renders only the cell an edit touched", async () => {
    const edited = createMarkdownCell({ content: "edited" });
    const untouched = createMarkdownCell({ content: "untouched" });
    render(<Host initial={[edited, untouched]} />);

    const editedBefore = renders.get(edited.id) ?? 0;
    const untouchedBefore = renders.get(untouched.id) ?? 0;

    await userEvent.setup().click(screen.getByRole("button", { name: `toggle ${edited.id}` }));

    expect(renders.get(edited.id)).toBeGreaterThan(editedBefore);
    expect(renders.get(untouched.id)).toBe(untouchedBefore);
  });
});
