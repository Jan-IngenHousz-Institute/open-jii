import type { ExperimentDataComment } from "@repo/api";

import type { SchemaData } from "../../../../common/modules/databricks/services/sql/sql.types";
import { addFakeCommentsColumns } from "./fake-experiment-data-comments";

describe("addFakeCommentsColumns", () => {
  let mockSchemaData: SchemaData;

  beforeEach(() => {
    mockSchemaData = {
      columns: [
        { name: "column1", type_name: "STRING", type_text: "STRING" },
        { name: "column2", type_name: "INT", type_text: "INT" },
      ],
      rows: [
        ["value1", "value2"],
        ["value3", "value4"],
        ["value5", "value6"],
      ],
      totalRows: 3,
      truncated: false,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should add id column at the beginning", () => {
    addFakeCommentsColumns(mockSchemaData);

    expect(mockSchemaData.columns[0]).toEqual({
      name: "id",
      type_name: "ID",
      type_text: "ID",
    });
  });

  it("should add comments column at the end", () => {
    addFakeCommentsColumns(mockSchemaData);

    const lastColumnIndex = mockSchemaData.columns.length - 1;
    expect(mockSchemaData.columns[lastColumnIndex]).toEqual({
      name: "comments",
      type_name: "JSON_COMMENTS",
      type_text: "JSON_COMMENTS",
    });
  });

  it("should maintain original columns between id and comments", () => {
    const originalColumns = [...mockSchemaData.columns];

    addFakeCommentsColumns(mockSchemaData);

    expect(mockSchemaData.columns).toHaveLength(originalColumns.length + 2);
    expect(mockSchemaData.columns[1]).toEqual(originalColumns[0]);
    expect(mockSchemaData.columns[2]).toEqual(originalColumns[1]);
  });

  it("should add UUID id to each row", () => {
    addFakeCommentsColumns(mockSchemaData);

    mockSchemaData.rows.forEach((row) => {
      expect(row[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  it("should add comments JSON to each row", () => {
    addFakeCommentsColumns(mockSchemaData);

    mockSchemaData.rows.forEach((row) => {
      const commentsData = row[row.length - 1];
      expect(typeof commentsData).toBe("string");

      if (typeof commentsData === "string") {
        // Should be valid JSON
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        expect(() => JSON.parse(commentsData)).not.toThrow();

        const parsedComments = JSON.parse(commentsData) as ExperimentDataComment[];
        expect(Array.isArray(parsedComments)).toBe(true);
      }
    });
  });

  it("should generate different comment patterns", () => {
    // Mock Math.random to test different cases
    const randomValues = [0.1, 0.3, 0.5, 0.7, 0.9]; // Will map to cases 1, 2, 3, 4, default
    let callIndex = 0;

    vi.spyOn(Math, "random").mockImplementation(() => {
      const value = randomValues[callIndex % randomValues.length];
      callIndex++;
      return value;
    });

    addFakeCommentsColumns(mockSchemaData);

    const commentPatterns = mockSchemaData.rows.map((row) => {
      const commentsData = row[row.length - 1];
      if (typeof commentsData === "string") {
        const parsedComments = JSON.parse(commentsData) as ExperimentDataComment[];
        return parsedComments.length;
      }
      return 0;
    });

    // Should have different comment counts (1, 2, 2, 2, 0)
    expect(new Set(commentPatterns).size).toBeGreaterThan(1);
  });

  it("should handle empty rows array", () => {
    mockSchemaData.rows = [];

    expect(() => addFakeCommentsColumns(mockSchemaData)).not.toThrow();
    expect(mockSchemaData.columns).toHaveLength(4); // original 2 + id + comments
    expect(mockSchemaData.rows).toHaveLength(0);
  });

  it("should generate valid comment structure", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.15); // Will generate case 1 (single comment)

    addFakeCommentsColumns(mockSchemaData);

    const firstRow = mockSchemaData.rows[0];
    const commentsData = firstRow[firstRow.length - 1];
    if (typeof commentsData === "string") {
      const firstRowComments = JSON.parse(commentsData) as ExperimentDataComment[];

      expect(firstRowComments).toHaveLength(1);
      const firstComment = firstRowComments[0];
      expect(firstComment.text).toBeDefined();
      expect(firstComment.createdBy).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(firstComment.createdByName).toBeDefined();
      expect(firstComment.createdAt).toBeDefined();
    }
  });

  it("should generate comments with flags when appropriate", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55); // Will generate case 3 (flag comment)

    addFakeCommentsColumns(mockSchemaData);

    const firstRow = mockSchemaData.rows[0];
    const commentsData = firstRow[firstRow.length - 1];
    if (typeof commentsData === "string") {
      const firstRowComments = JSON.parse(commentsData) as ExperimentDataComment[];

      expect(firstRowComments).toHaveLength(2);
      const firstComment = firstRowComments[0];
      expect(firstComment).toHaveProperty("flag");
      expect(["outlier", "needs_review"]).toContain(firstComment.flag);
    }
  });
});
