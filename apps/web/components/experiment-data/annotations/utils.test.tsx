import React from "react";
import { v4 as uuidv4 } from "uuid";
import { it, expect, vi, describe } from "vitest";
import type { AnnotationsProps } from "~/components/experiment-data/annotations/annotations";
import {
  getAnnotationData,
  getAnnotationsColumn,
  isAnnotationData,
} from "~/components/experiment-data/annotations/utils";

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

describe("getAnnotationData", () => {
  const comment1: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User One",
    type: "comment",
    content: { text: "Test comment 1" },
    createdAt: "2025-09-01T00:00:00Z",
    updatedAt: "2025-09-01T00:00:00Z",
  };

  const flag1: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User Three",
    type: "flag",
    content: { flagType: "outlier", reason: "Flagged as outlier" },
    createdAt: "2025-09-03T00:00:00Z",
    updatedAt: "2025-09-03T00:00:00Z",
  };

  const flag2: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User Four",
    type: "flag",
    content: { flagType: "needs_review", reason: "Needs review" },
    createdAt: "2025-09-04T00:00:00Z",
    updatedAt: "2025-09-04T00:00:00Z",
  };

  it("should aggregate annotation data correctly", () => {
    const annotations: Annotation[] = [comment1, flag1, flag2];

    const result = getAnnotationData(annotations);

    expect(result.count).toBe(3);
    expect(result.commentCount).toBe(1);
    expect(result.flagCount).toBe(2);
    expect(Array.from(result.uniqueFlags)).toEqual(["outlier", "needs_review"]);
    expect(result.annotationsPerType.comment).toHaveLength(1);
    expect(result.annotationsPerType.flag).toHaveLength(2);
  });

  it("should handle empty annotations array", () => {
    const result = getAnnotationData([]);
    expect(result.count).toBe(0);
    expect(result.commentCount).toBe(0);
    expect(result.flagCount).toBe(0);
    expect(Array.from(result.uniqueFlags)).toEqual([]);
    expect(result.annotationsPerType).toEqual({});
  });
});

describe("isAnnotationData", () => {
  const comment1: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User One",
    type: "comment",
    content: { text: "Test comment 1" },
    createdAt: "2025-09-01T00:00:00Z",
    updatedAt: "2025-09-01T00:00:00Z",
  };

  const flag1: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User Three",
    type: "flag",
    content: { flagType: "outlier", reason: "Flagged as outlier" },
    createdAt: "2025-09-03T00:00:00Z",
    updatedAt: "2025-09-03T00:00:00Z",
  };

  it("should return true for valid AnnotationData", () => {
    const validData = {
      annotations: [comment1, flag1],
      annotationsPerType: { comment: [comment1], flag: [flag1] },
      uniqueFlags: new Set(["outlier"]),
      count: 2,
      commentCount: 1,
      flagCount: 1,
    };

    expect(isAnnotationData(validData)).toBe(true);
  });

  it("should return false for null", () => {
    expect(isAnnotationData(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isAnnotationData(undefined)).toBe(false);
  });

  it("should return false for primitive types", () => {
    expect(isAnnotationData("string")).toBe(false);
    expect(isAnnotationData(123)).toBe(false);
    expect(isAnnotationData(true)).toBe(false);
  });

  it("should return false when annotations is not an array", () => {
    const invalidData = {
      annotations: "not an array",
      annotationsPerType: {},
      uniqueFlags: new Set(),
      count: 0,
      commentCount: 0,
      flagCount: 0,
    };

    expect(isAnnotationData(invalidData)).toBe(false);
  });

  it("should return false when annotationsPerType is not an object", () => {
    const invalidData = {
      annotations: [],
      annotationsPerType: "not an object",
      uniqueFlags: new Set(),
      count: 0,
      commentCount: 0,
      flagCount: 0,
    };

    expect(isAnnotationData(invalidData)).toBe(false);
  });

  it("should return false when uniqueFlags is not a Set", () => {
    const invalidData = {
      annotations: [],
      annotationsPerType: {},
      uniqueFlags: ["not", "a", "set"],
      count: 0,
      commentCount: 0,
      flagCount: 0,
    };

    expect(isAnnotationData(invalidData)).toBe(false);
  });

  it("should return false when count is not a number", () => {
    const invalidData = {
      annotations: [],
      annotationsPerType: {},
      uniqueFlags: new Set(),
      count: "not a number",
      commentCount: 0,
      flagCount: 0,
    };

    expect(isAnnotationData(invalidData)).toBe(false);
  });

  it("should return false when commentCount is not a number", () => {
    const invalidData = {
      annotations: [],
      annotationsPerType: {},
      uniqueFlags: new Set(),
      count: 0,
      commentCount: "not a number",
      flagCount: 0,
    };

    expect(isAnnotationData(invalidData)).toBe(false);
  });

  it("should return false when flagCount is not a number", () => {
    const invalidData = {
      annotations: [],
      annotationsPerType: {},
      uniqueFlags: new Set(),
      count: 0,
      commentCount: 0,
      flagCount: "not a number",
    };

    expect(isAnnotationData(invalidData)).toBe(false);
  });

  it("should return false when required properties are missing", () => {
    const incompleteData = {
      annotations: [],
      annotationsPerType: {},
      // missing uniqueFlags, count, commentCount, flagCount
    };

    expect(isAnnotationData(incompleteData)).toBe(false);
  });
});

describe("getAnnotationsColumn", () => {
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

    expect(result).not.toBeNull();
    if (result) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.props.experimentId).toBe("exp123");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.props.tableName).toBe("tableA");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.props.rowIds).toEqual(["row42"]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.props.data).toBe(data);
    }
  });

  it("getAnnotationsColumn returns null for invalid data", () => {
    const commentRowId = {
      experimentId: "exp123",
      tableName: "tableA",
      rowId: "row42",
    };
    const result = getAnnotationsColumn(commentRowId, { invalid: "data" });

    expect(result).toBeNull();
  });
});
