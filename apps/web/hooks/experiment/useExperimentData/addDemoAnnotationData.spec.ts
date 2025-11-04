import { describe, it, expect } from "vitest";
import { isAnnotationData } from "~/components/experiment-data/annotations/utils";

import type { ExperimentData } from "@repo/api";

import { addDemoAnnotationData } from "./addDemoAnnotationData";

describe("addDemoAnnotationData", () => {
  it("should add id and annotations columns when they do not exist", () => {
    const mockData: ExperimentData = {
      columns: [
        { name: "name", type_name: "STRING", type_text: "STRING" },
        { name: "value", type_name: "NUMBER", type_text: "NUMBER" },
      ],
      rows: [
        { name: "Test 1", value: 100 },
        { name: "Test 2", value: 200 },
      ],
      totalRows: 2,
      truncated: false,
    };

    addDemoAnnotationData(mockData);

    // Check that id and annotations columns were added
    expect(mockData.columns).toHaveLength(4);
    expect(mockData.columns[0].name).toBe("annotations");
    expect(mockData.columns[0].type_name).toBe("ANNOTATIONS");
    expect(mockData.columns[1].name).toBe("id");
    expect(mockData.columns[1].type_name).toBe("ID");

    // Check that each row has id and annotations
    mockData.rows.forEach((row) => {
      expect(row.id).toBeDefined();
      expect(typeof row.id).toBe("string");
      expect(row.annotations).toBeDefined();
      expect(isAnnotationData(row.annotations)).toBe(true);
    });
  });

  it("should not modify data when id column already exists", () => {
    const mockData: ExperimentData = {
      columns: [
        { name: "id", type_name: "ID", type_text: "ID" },
        { name: "name", type_name: "STRING", type_text: "STRING" },
      ],
      rows: [{ id: "existing-id", name: "Test 1" }],
      totalRows: 2,
      truncated: false,
    };

    const originalColumnsLength = mockData.columns.length;
    addDemoAnnotationData(mockData);

    expect(mockData.columns).toHaveLength(originalColumnsLength);
    expect(mockData.rows[0].id).toBe("existing-id");
  });
});
