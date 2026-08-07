"use client";

import type { BranchCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { BranchCellComponent } from "../workbook/cells/branch-cell";

interface BranchPanelProps {
  cell: BranchCell;
  allCells: WorkbookCell[];
  onChange: (cell: BranchCell) => void;
  disabled?: boolean;
}

export function BranchPanel({ cell, allCells, onChange, disabled }: BranchPanelProps) {
  return (
    <BranchCellComponent cell={cell} allCells={allCells} onUpdate={onChange} readOnly={disabled} />
  );
}
