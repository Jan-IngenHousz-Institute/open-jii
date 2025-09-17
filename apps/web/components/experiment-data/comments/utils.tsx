import type { Row } from "@tanstack/react-table";
import React from "react";
import { RenderCommentsAndFlags } from "~/components/experiment-data/comments/comments-and-flags";
import type { DataRow } from "~/hooks/experiment/useExperimentData/useExperimentData";

import { Checkbox } from "@repo/ui/components";

export function getToggleAllRowsCheckbox() {
  return <div id="rowToggleAll" />;
}

export function getRowCheckbox(row: Row<DataRow>) {
  return (
    <Checkbox
      checked={row.getIsSelected()}
      disabled={!row.getCanSelect()}
      onCheckedChange={row.getToggleSelectedHandler()}
    />
  );
}

export interface CommentsRowIdentifier {
  experimentId: string;
  tableName: string;
  rowId: string;
}

export function getCommentsColumn(commentRowId: CommentsRowIdentifier, commentsJSON: string) {
  return (
    <RenderCommentsAndFlags
      experimentId={commentRowId.experimentId}
      tableName={commentRowId.tableName}
      rowIds={[commentRowId.rowId]}
      commentsJSON={commentsJSON}
    />
  );
}
