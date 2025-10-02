import type { Row } from "@tanstack/react-table";
import React from "react";
import { it, expect, vi } from "vitest";
import type { RenderCommentsAndFlagsProps } from "~/components/experiment-data/comments/comments-and-flags";
import {
  getToggleAllRowsCheckbox,
  getRowCheckbox,
  getCommentsColumn,
} from "~/components/experiment-data/comments/utils";
import type { DataRow } from "~/hooks/experiment/useExperimentData/useExperimentData";

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Checkbox: ({
    checked,
    disabled,
  }: {
    checked: boolean | "indeterminate";
    disabled?: boolean;
    onCheckedChange?: () => void;
  }) => (
    <div data-testid="checkbox" data-checked={checked} data-disabled={disabled}>
      Checkbox
    </div>
  ),
}));

// Mock RenderCommentsAndFlags
vi.mock("~/components/experiment-data/comments/comments-and-flags", () => ({
  RenderCommentsAndFlags: ({
    experimentId,
    tableName,
    rowIds,
    commentsJSON,
  }: RenderCommentsAndFlagsProps) => (
    <div
      data-testid="render-comments-and-flags"
      data-experimentid={experimentId}
      data-tablename={tableName}
      data-rowids={rowIds.join(",")}
      data-commentsjson={commentsJSON}
    >
      RenderCommentsAndFlags
    </div>
  ),
}));

it("getToggleAllRowsCheckbox", () => {
  const result = getToggleAllRowsCheckbox();
  expect(result).toStrictEqual(<div id="rowToggleAll" />);
});

it("getRowCheckbox returns Checkbox with correct props", () => {
  const mockRow = {
    getIsSelected: vi.fn().mockReturnValue(true),
    getCanSelect: vi.fn().mockReturnValue(false),
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    getToggleSelectedHandler: vi.fn().mockReturnValue(() => {}),
  };
  const result = getRowCheckbox(mockRow as unknown as Row<DataRow>);

  // Render and check props
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(result.props.checked).toBe(true);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(result.props.disabled).toBe(true);
});

it("getCommentsColumn returns RenderCommentsAndFlags with correct props", () => {
  const commentRowId = {
    experimentId: "exp123",
    tableName: "tableA",
    rowId: "row42",
  };
  const commentsJSON = '[{"text":"hello"}]';
  const result = getCommentsColumn(commentRowId, commentsJSON);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(result.props.experimentId).toBe("exp123");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(result.props.tableName).toBe("tableA");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(result.props.rowIds).toEqual(["row42"]);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(result.props.commentsJSON).toBe(commentsJSON);
});
