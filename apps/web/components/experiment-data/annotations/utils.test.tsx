import React from "react";
import { v4 as uuidv4 } from "uuid";
import { it, expect, vi } from "vitest";
import type { AnnotationsProps } from "~/components/experiment-data/annotations/annotations";
import { getAnnotationsColumn } from "~/components/experiment-data/annotations/utils";
import { getAnnotationData } from "~/hooks/experiment/useExperimentData/useExperimentData";

import type { Annotation } from "@repo/api";

// Mock Annotations
vi.mock("~/components/experiment-data/annotations/annotations", () => ({
  Annotations: ({ experimentId, tableName, rowIds, data }: AnnotationsProps) => (
    <div
      data-testid="render-comments-and-flags"
      data-experimentid={experimentId}
      data-tablename={tableName}
      data-rowids={rowIds.join(",")}
      data-data={data}
    >
      Annotations
    </div>
  ),
}));

it("getAnnotationsColumn returns Annotations with correct props", () => {
  const commentRowId = {
    experimentId: "exp123",
    tableName: "tableA",
    rowId: "row42",
  };
  const comment1: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User One",
    type: "comment",
    content: { text: "Test comment 1" },
    createdAt: "2025-09-01T00:00:00Z",
    updatedAt: "2025-09-01T00:00:00Z",
  };
  const data = getAnnotationData([comment1]);
  const result = getAnnotationsColumn(commentRowId, data);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(result.props.experimentId).toBe("exp123");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(result.props.tableName).toBe("tableA");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(result.props.rowIds).toEqual(["row42"]);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(result.props.data).toBe(data);
});
