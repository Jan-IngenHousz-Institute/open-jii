/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { renderHook } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import type { ExperimentDataResponse, AnnotationType, AnnotationContent } from "@repo/api";

import { useExperimentAnnotationOptimisticUpdate } from "./useExperimentAnnotationOptimisticUpdate";

// Mock the parseAnnotations function
vi.mock(
  "~/components/experiment-data/table-cells/annotations/experiment-data-table-annotations-cell",
  () => ({
    parseAnnotations: vi.fn((str: string): unknown[] => {
      try {
        return JSON.parse(str) as unknown[];
      } catch {
        return [];
      }
    }),
  }),
);

// Mock structuredClone for older test environments
Object.assign(global, {
  structuredClone: vi.fn((obj: unknown) => JSON.parse(JSON.stringify(obj)) as unknown),
});

describe("useExperimentAnnotationOptimisticUpdate", () => {
  const mockExperimentData: ExperimentDataResponse = [
    {
      name: "test_table",
      catalog_name: "test_catalog",
      schema_name: "test_schema",
      page: 1,
      pageSize: 10,
      totalPages: 1,
      totalRows: 2,
      data: {
        columns: [
          {
            name: "id",
            type_text: "STRING",
            type_name: "string",
          },
          {
            name: "annotations",
            type_text:
              "ARRAY<STRUCT<id: STRING, rowId: STRING, type: STRING, content: STRUCT<text: STRING, flagType: STRING>, createdBy: STRING, createdByName: STRING, createdAt: TIMESTAMP, updatedAt: TIMESTAMP>>",
            type_name: "array",
          },
        ],
        rows: [
          { id: "row1", annotations: "[]" },
          { id: "row2", annotations: "[]" },
        ],
        totalRows: 2,
        truncated: false,
      },
    },
  ];

  const mockAnnotationRequest: { type: AnnotationType; content: AnnotationContent } = {
    type: "comment",
    content: { type: "comment", text: "Test annotation" },
  };

  describe("update function", () => {
    it("should add annotation to experiment data", () => {
      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { update } = result.current;

      const updatedData = update(mockExperimentData, "test_table", ["row1"], mockAnnotationRequest);

      expect(updatedData).not.toBe(mockExperimentData); // Should be a new object
      expect(updatedData[0]?.data?.rows[0]?.annotations).not.toBe("[]");

      const annotations = JSON.parse(updatedData[0]?.data?.rows[0]?.annotations as string);
      expect(annotations).toHaveLength(1);
      expect(annotations[0]).toMatchObject({
        type: "comment",
        content: { text: "Test annotation" },
        rowId: "row1",
        preview: true,
        createdByName: "You",
      });
    });

    it("should add annotations to multiple rows", () => {
      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { update } = result.current;

      const updatedData = update(
        mockExperimentData,
        "test_table",
        ["row1", "row2"],
        mockAnnotationRequest,
      );

      const row1Annotations = JSON.parse(updatedData[0]?.data?.rows[0]?.annotations as string);
      const row2Annotations = JSON.parse(updatedData[0]?.data?.rows[1]?.annotations as string);

      expect(row1Annotations).toHaveLength(1);
      expect(row2Annotations).toHaveLength(1);
      expect(row1Annotations[0].rowId).toBe("row1");
      expect(row2Annotations[0].rowId).toBe("row2");
    });

    it("should append to existing annotations", () => {
      const dataWithExistingAnnotations: ExperimentDataResponse = [
        {
          ...mockExperimentData[0],
          data: {
            columns: mockExperimentData[0].data?.columns ?? [],
            totalRows: 2,
            truncated: false,
            rows: [
              {
                id: "row1",
                annotations: JSON.stringify([
                  {
                    id: "existing-1",
                    type: "flag",
                    content: { type: "flag", text: "Existing annotation", flagType: "outlier" },
                    rowId: "row1",
                  },
                ]),
              },
              { id: "row2", annotations: "[]" },
            ],
          },
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { update } = result.current;

      const updatedData = update(
        dataWithExistingAnnotations,
        "test_table",
        ["row1"],
        mockAnnotationRequest,
      );

      const firstRow = updatedData[0]?.data?.rows?.[0];
      expect(firstRow?.annotations).toBeDefined();
      const annotations = JSON.parse(firstRow?.annotations as string);
      expect(annotations).toHaveLength(2);
      expect(annotations[0].id).toBe("existing-1");
      expect(annotations[1].type).toBe("comment");
    });

    it("should handle null/undefined annotation column values with fallback", () => {
      const dataWithNullAnnotations: ExperimentDataResponse = [
        {
          ...mockExperimentData[0],
          data: {
            columns: mockExperimentData[0].data?.columns ?? [],
            totalRows: 3,
            truncated: false,
            rows: [
              { id: "row1", annotations: null }, // null value
              { id: "row2", annotations: undefined }, // undefined value
              { id: "row3" }, // missing annotations property
            ],
          },
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { update } = result.current;

      const updatedData = update(
        dataWithNullAnnotations,
        "test_table",
        ["row1", "row2", "row3"],
        mockAnnotationRequest,
      );

      const rows = updatedData[0]?.data?.rows;
      expect(rows).toBeDefined();
      if (rows) {
        // All rows should have been updated since they all fell back to "[]"
        const row1Annotations = JSON.parse(rows[0]?.annotations as string);
        const row2Annotations = JSON.parse(rows[1]?.annotations as string);
        const row3Annotations = JSON.parse(rows[2]?.annotations as string);

        expect(row1Annotations).toHaveLength(1);
        expect(row2Annotations).toHaveLength(1);
        expect(row3Annotations).toHaveLength(1);

        expect(row1Annotations[0].type).toBe("comment");
        expect(row2Annotations[0].type).toBe("comment");
        expect(row3Annotations[0].type).toBe("comment");
      }
    });

    it("should only update rows with proper row IDs", () => {
      const dataWithMissingIds: ExperimentDataResponse = [
        {
          ...mockExperimentData[0],
          data: {
            columns: mockExperimentData[0].data?.columns ?? [],
            totalRows: 3,
            truncated: false,
            rows: [
              { id: "row1", annotations: "[]" },
              { annotations: "[]" }, // No id field
              { id: null, annotations: "[]" }, // Null id
            ],
          },
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { update } = result.current;

      const updatedData = update(
        dataWithMissingIds,
        "test_table",
        ["row1", "row2", "row3"],
        mockAnnotationRequest,
      );

      const rows = updatedData[0]?.data?.rows;
      expect(rows).toBeDefined();
      if (rows) {
        const row1Annotations = JSON.parse(rows[0]?.annotations as string);
        const row2Annotations = JSON.parse(rows[1]?.annotations as string);
        const row3Annotations = JSON.parse(rows[2]?.annotations as string);

        expect(row1Annotations).toHaveLength(1); // Should be updated
        expect(row2Annotations).toHaveLength(0); // Should not be updated (no id)
        expect(row3Annotations).toHaveLength(0); // Should not be updated (null id)
      }
    });

    it("should return original data if no experiment data", () => {
      const emptyData: ExperimentDataResponse = [
        {
          name: "test_table",
          catalog_name: "test_catalog",
          schema_name: "test_schema",
          page: 1,
          pageSize: 10,
          totalPages: 1,
          totalRows: 0,
          data: undefined,
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { removeBulk } = result.current;

      const updatedData = removeBulk(
        emptyData,
        "test_table",
        ["row1"],
        "comment" as AnnotationType,
      );

      expect(updatedData).toBe(emptyData);
    });

    it("should return original data if no annotations column", () => {
      const dataWithoutAnnotationColumn: ExperimentDataResponse = [
        {
          ...mockExperimentData[0],
          data: {
            columns: [
              {
                name: "id",
                type_text: "STRING",
                type_name: "string",
              },
            ],
            rows: mockExperimentData[0].data?.rows ?? [],
            totalRows: 2,
            truncated: false,
          },
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { update } = result.current;

      const updatedData = update(
        dataWithoutAnnotationColumn,
        "test_table",
        ["row1"],
        mockAnnotationRequest,
      );

      expect(updatedData).toBe(dataWithoutAnnotationColumn);
    });

    it("should return original data if table name doesn't match", () => {
      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { update } = result.current;

      const updatedData = update(
        mockExperimentData,
        "different_table",
        ["row1"],
        mockAnnotationRequest,
      );

      expect(updatedData).toBe(mockExperimentData);
    });

    it("should return original data if no experiment data", () => {
      const emptyData: ExperimentDataResponse = [
        {
          name: "test_table",
          catalog_name: "test_catalog",
          schema_name: "test_schema",
          page: 1,
          pageSize: 10,
          totalPages: 1,
          totalRows: 0,
          data: undefined,
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { update } = result.current;

      const updatedData = update(emptyData, "test_table", ["row1"], mockAnnotationRequest);

      expect(updatedData).toBe(emptyData);
    });

    it("should return original data when data array is empty", () => {
      const emptyArrayData: ExperimentDataResponse = [];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { update } = result.current;

      const updatedData = update(emptyArrayData, "test_table", ["row1"], mockAnnotationRequest);

      expect(updatedData).toBe(emptyArrayData);
    });
  });

  describe("remove function", () => {
    it("should remove annotation by ID", () => {
      const dataWithAnnotations: ExperimentDataResponse = [
        {
          ...mockExperimentData[0],
          data: {
            columns: mockExperimentData[0].data?.columns ?? [],
            totalRows: 2,
            truncated: false,
            rows: [
              {
                id: "row1",
                annotations: JSON.stringify([
                  {
                    id: "annotation-1",
                    type: "comment",
                    content: { type: "comment", text: "First annotation" },
                    rowId: "row1",
                  },
                  {
                    id: "annotation-2",
                    type: "flag",
                    content: { type: "flag", text: "Second annotation", flagType: "outlier" },
                    rowId: "row1",
                  },
                ]),
              },
              { id: "row2", annotations: "[]" },
            ],
          },
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { remove } = result.current;

      const updatedData = remove(dataWithAnnotations, "annotation-1");

      expect(updatedData).not.toBe(dataWithAnnotations);
      const firstRow = updatedData[0]?.data?.rows?.[0];
      expect(firstRow?.annotations).toBeDefined();
      const annotations = JSON.parse(firstRow?.annotations as string);
      expect(annotations).toHaveLength(1);
      expect(annotations[0].id).toBe("annotation-2");
    });

    it("should remove annotation from all rows", () => {
      const dataWithAnnotations: ExperimentDataResponse = [
        {
          ...mockExperimentData[0],
          data: {
            columns: mockExperimentData[0].data?.columns ?? [],
            totalRows: 2,
            truncated: false,
            rows: [
              {
                id: "row1",
                annotations: JSON.stringify([
                  {
                    id: "annotation-1",
                    type: "comment",
                    content: { type: "comment", text: "Test" },
                    rowId: "row1",
                  },
                ]),
              },
              {
                id: "row2",
                annotations: JSON.stringify([
                  {
                    id: "annotation-1",
                    type: "comment",
                    content: { type: "comment", text: "Test" },
                    rowId: "row2",
                  },
                ]),
              },
            ],
          },
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { remove } = result.current;

      const updatedData = remove(dataWithAnnotations, "annotation-1");

      const rows = updatedData[0]?.data?.rows;
      expect(rows).toBeDefined();
      if (rows) {
        const row1Annotations = JSON.parse(rows[0]?.annotations as string);
        const row2Annotations = JSON.parse(rows[1]?.annotations as string);

        expect(row1Annotations).toHaveLength(0);
        expect(row2Annotations).toHaveLength(0);
      }
    });

    it("should return original data if no experiment data", () => {
      const emptyData: ExperimentDataResponse = [
        {
          name: "test_table",
          catalog_name: "test_catalog",
          schema_name: "test_schema",
          page: 1,
          pageSize: 10,
          totalPages: 1,
          totalRows: 0,
          data: undefined,
        },
      ];
      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { remove } = result.current;

      const updatedData = remove(emptyData, "annotation-1");

      expect(updatedData).toBe(emptyData);
    });

    it("should handle null/undefined annotation column values in remove function", () => {
      const dataWithNullAnnotations: ExperimentDataResponse = [
        {
          ...mockExperimentData[0],
          data: {
            columns: mockExperimentData[0].data?.columns ?? [],
            totalRows: 3,
            truncated: false,
            rows: [
              { id: "row1", annotations: null }, // null value
              { id: "row2", annotations: undefined }, // undefined value
              { id: "row3" }, // missing annotations property
            ],
          },
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { remove } = result.current;

      const updatedData = remove(dataWithNullAnnotations, "some-annotation-id");

      const rows = updatedData[0]?.data?.rows;
      expect(rows).toBeDefined();
      if (rows) {
        // All rows should have empty annotations array since they fell back to "[]"
        const row1Annotations = JSON.parse(rows[0]?.annotations as string);
        const row2Annotations = JSON.parse(rows[1]?.annotations as string);
        const row3Annotations = JSON.parse(rows[2]?.annotations as string);

        expect(row1Annotations).toHaveLength(0);
        expect(row2Annotations).toHaveLength(0);
        expect(row3Annotations).toHaveLength(0);
      }
    });
  });

  describe("removeBulk function", () => {
    it("should remove annotations by type and row IDs", () => {
      const dataWithAnnotations: ExperimentDataResponse = [
        {
          ...mockExperimentData[0],
          data: {
            columns: mockExperimentData[0].data?.columns ?? [],
            totalRows: 2,
            truncated: false,
            rows: [
              {
                id: "row1",
                annotations: JSON.stringify([
                  {
                    id: "annotation-1",
                    type: "comment",
                    content: { type: "comment", text: "Comment annotation" },
                    rowId: "row1",
                  },
                  {
                    id: "annotation-2",
                    type: "flag",
                    content: { type: "flag", text: "Flag annotation", flagType: "outlier" },
                    rowId: "row1",
                  },
                ]),
              },
              {
                id: "row2",
                annotations: JSON.stringify([
                  {
                    id: "annotation-3",
                    type: "comment",
                    content: { type: "comment", text: "Comment annotation" },
                    rowId: "row2",
                  },
                ]),
              },
            ],
          },
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { removeBulk } = result.current;

      const updatedData = removeBulk(
        dataWithAnnotations,
        "test_table",
        ["row1", "row2"],
        "comment" as AnnotationType,
      );

      expect(updatedData).not.toBe(dataWithAnnotations);

      const rows = updatedData[0]?.data?.rows;
      expect(rows).toBeDefined();
      if (rows) {
        const row1Annotations = JSON.parse(rows[0]?.annotations as string);
        const row2Annotations = JSON.parse(rows[1]?.annotations as string);

        expect(row1Annotations).toHaveLength(1);
        expect(row1Annotations[0].type).toBe("flag"); // Only flag annotation should remain
        expect(row2Annotations).toHaveLength(0); // Comment annotation should be removed
      }
    });

    it("should only remove from rows with proper row IDs", () => {
      const dataWithMissingIds: ExperimentDataResponse = [
        {
          ...mockExperimentData[0],
          data: {
            columns: mockExperimentData[0].data?.columns ?? [],
            totalRows: 2,
            truncated: false,
            rows: [
              {
                id: "row1",
                annotations: JSON.stringify([
                  {
                    id: "annotation-1",
                    type: "comment",
                    content: { type: "comment", text: "Test" },
                    rowId: "row1",
                  },
                ]),
              },
              {
                // No id field
                annotations: JSON.stringify([
                  {
                    id: "annotation-2",
                    type: "comment",
                    content: { type: "comment", text: "Test" },
                    rowId: "unknown",
                  },
                ]),
              },
            ],
          },
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { removeBulk } = result.current;

      const updatedData = removeBulk(
        dataWithMissingIds,
        "test_table",
        ["row1", "row2"],
        "comment" as AnnotationType,
      );

      const rows = updatedData[0]?.data?.rows;
      expect(rows).toBeDefined();
      if (rows) {
        const row1Annotations = JSON.parse(rows[0]?.annotations as string);
        const row2Annotations = JSON.parse(rows[1]?.annotations as string);

        expect(row1Annotations).toHaveLength(0); // Should be removed (has proper id)
        expect(row2Annotations).toHaveLength(1); // Should not be removed (no proper id)
      }
    });

    it("should return original data if table name doesn't match", () => {
      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { removeBulk } = result.current;

      const updatedData = removeBulk(
        mockExperimentData,
        "different_table",
        ["row1"],
        "comment" as AnnotationType,
      );

      expect(updatedData).toBe(mockExperimentData);
    });

    it("should return original data if no experiment data", () => {
      const emptyData: ExperimentDataResponse = [
        {
          name: "test_table",
          catalog_name: "test_catalog",
          schema_name: "test_schema",
          page: 1,
          pageSize: 10,
          totalPages: 1,
          totalRows: 0,
          data: undefined,
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { removeBulk } = result.current;

      const updatedData = removeBulk(
        emptyData,
        "test_table",
        ["row1"],
        "comment" as AnnotationType,
      );

      expect(updatedData).toBe(emptyData);
    });

    it("should handle null/undefined annotation column values in removeBulk function", () => {
      const dataWithNullAnnotations: ExperimentDataResponse = [
        {
          ...mockExperimentData[0],
          data: {
            columns: mockExperimentData[0].data?.columns ?? [],
            totalRows: 3,
            truncated: false,
            rows: [
              { id: "row1", annotations: null }, // null value - should use fallback
              { id: "row2", annotations: undefined }, // undefined value - should use fallback
              { id: "row3" }, // missing annotations property - should use fallback
            ],
          },
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { removeBulk } = result.current;

      const updatedData = removeBulk(
        dataWithNullAnnotations,
        "test_table",
        ["row1", "row2", "row3"],
        "comment" as AnnotationType,
      );

      const rows = updatedData[0]?.data?.rows;
      expect(rows).toBeDefined();
      if (rows) {
        // All rows should have empty annotations array since they fell back to "[]" and had no matching annotations to remove
        const row1Annotations = JSON.parse(rows[0]?.annotations as string);
        const row2Annotations = JSON.parse(rows[1]?.annotations as string);
        const row3Annotations = JSON.parse(rows[2]?.annotations as string);

        expect(row1Annotations).toHaveLength(0);
        expect(row2Annotations).toHaveLength(0);
        expect(row3Annotations).toHaveLength(0);
      }
    });
  });

  describe("deep copy functionality", () => {
    it("should use structuredClone when available", () => {
      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { update } = result.current;

      const updatedData = update(mockExperimentData, "test_table", ["row1"], mockAnnotationRequest);

      expect(global.structuredClone).toHaveBeenCalledWith(mockExperimentData);
      expect(updatedData).not.toBe(mockExperimentData);
    });

    it("should fall back to JSON when structuredClone is not available", () => {
      // Temporarily remove structuredClone
      const originalStructuredClone = global.structuredClone;
      delete (global as { structuredClone?: unknown }).structuredClone;

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { update } = result.current;

      const updatedData = update(mockExperimentData, "test_table", ["row1"], mockAnnotationRequest);

      expect(updatedData).not.toBe(mockExperimentData);
      const firstRow = updatedData[0]?.data?.rows?.[0];
      expect(firstRow?.annotations).not.toBe("[]");

      // Restore structuredClone
      global.structuredClone = originalStructuredClone;
    });
  });

  describe("findAnnotationsColumnName function (via update)", () => {
    it("should return original data when table data has empty columns array", () => {
      const dataWithEmptyColumns: ExperimentDataResponse = [
        {
          name: "test_table",
          catalog_name: "test_catalog",
          schema_name: "test_schema",
          page: 1,
          pageSize: 10,
          totalPages: 1,
          totalRows: 0,
          data: {
            columns: [], // Empty columns array
            rows: [{ id: "row1", annotations: "[]" }],
            totalRows: 1,
            truncated: false,
          },
        },
      ];

      const { result } = renderHook(() => useExperimentAnnotationOptimisticUpdate());
      const { update } = result.current;

      const updatedData = update(
        dataWithEmptyColumns,
        "test_table",
        ["row1"],
        mockAnnotationRequest,
      );

      // Should return original data unchanged since no columns exist
      expect(updatedData).toBe(dataWithEmptyColumns);
    });
  });
});
