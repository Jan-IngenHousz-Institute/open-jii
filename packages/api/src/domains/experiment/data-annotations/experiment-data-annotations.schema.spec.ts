import { describe, expect, it } from "vitest";

import {
  zExperimentAddAnnotationBody,
  zExperimentAddAnnotationsBulkBody,
  zExperimentAnnotation,
  zExperimentAnnotationCommentContent,
  zExperimentAnnotationContent,
  zExperimentAnnotationDeleteBulkBody,
  zExperimentAnnotationDeleteBulkPathParam,
  zExperimentAnnotationFlagContent,
  zExperimentAnnotationFlagType,
  zExperimentAnnotationList,
  zExperimentAnnotationPathParam,
  zExperimentAnnotationRowsAffected,
  zExperimentAnnotationType,
  zExperimentListAnnotationsQuery,
  zExperimentUpdateAnnotationBody,
} from "./experiment-data-annotations.schema";

const uuidA = "11111111-1111-1111-1111-111111111111";
const uuidB = "22222222-2222-2222-2222-222222222222";
const isoTime = "2024-01-15T10:00:00Z";
const isoTime2 = "2024-01-15T11:00:00Z";

describe("Annotations", () => {
  it("zExperimentAnnotationType accepts valid values", () => {
    expect(zExperimentAnnotationType.parse("comment")).toBe("comment");
    expect(zExperimentAnnotationType.parse("flag")).toBe("flag");
    expect(() => zExperimentAnnotationType.parse("note")).toThrow();
  });

  it("zExperimentAnnotationFlagType accepts valid values", () => {
    expect(zExperimentAnnotationFlagType.parse("outlier")).toBe("outlier");
    expect(zExperimentAnnotationFlagType.parse("needs_review")).toBe("needs_review");
    expect(() => zExperimentAnnotationFlagType.parse("invalid")).toThrow();
  });

  it("zExperimentAnnotationCommentContent valid", () => {
    const comment = { type: "comment", text: "This is a comment" };
    expect(zExperimentAnnotationCommentContent.parse(comment)).toEqual(comment);
  });

  it("zExperimentAnnotationCommentContent rejects empty text", () => {
    expect(() =>
      zExperimentAnnotationCommentContent.parse({ type: "comment", text: "" }),
    ).toThrow();
  });

  it("zExperimentAnnotationCommentContent rejects text too long", () => {
    const longText = "a".repeat(256);
    expect(() =>
      zExperimentAnnotationCommentContent.parse({ type: "comment", text: longText }),
    ).toThrow();
  });

  it("zExperimentAnnotationFlagContent valid with text", () => {
    const flag = { type: "flag", flagType: "outlier", text: "This is flagged as outlier" };
    expect(zExperimentAnnotationFlagContent.parse(flag)).toEqual(flag);
  });

  it("zExperimentAnnotationFlagContent valid without text", () => {
    const flag = { type: "flag", flagType: "needs_review" };
    expect(zExperimentAnnotationFlagContent.parse(flag)).toEqual(flag);
  });

  it("zExperimentAnnotationContent discriminated union works", () => {
    const comment = { type: "comment", text: "Comment text" };
    const flag = { type: "flag", flagType: "outlier", text: "Flag text" };

    expect(zExperimentAnnotationContent.parse(comment)).toEqual(comment);
    expect(zExperimentAnnotationContent.parse(flag)).toEqual(flag);

    // Invalid type for comment
    expect(() =>
      zExperimentAnnotationContent.parse({ type: "comment", flagType: "outlier" }),
    ).toThrow();
    // Invalid type for flag
    expect(() =>
      zExperimentAnnotationContent.parse({ type: "flag", text: "no flagType" }),
    ).toThrow();
  });

  it("zExperimentAnnotation valid complete", () => {
    const annotation = {
      id: uuidA,
      rowId: "row-123",
      type: "comment",
      content: { type: "comment", text: "Test comment" },
      createdBy: uuidB,
      createdByName: "John Doe",
      createdAt: isoTime,
      updatedAt: isoTime2,
    };
    expect(zExperimentAnnotation.parse(annotation)).toEqual(annotation);
  });

  it("zExperimentAnnotation valid without optional fields", () => {
    const annotation = {
      id: uuidA,
      type: "flag",
      content: { type: "flag", flagType: "outlier" },
      createdBy: uuidB,
      createdAt: isoTime,
      updatedAt: isoTime2,
    };
    expect(zExperimentAnnotation.parse(annotation)).toEqual(annotation);
  });

  it("zExperimentAnnotationList valid array", () => {
    const annotations = [
      {
        id: uuidA,
        type: "comment",
        content: { type: "comment", text: "Comment 1" },
        createdBy: uuidB,
        createdAt: isoTime,
        updatedAt: isoTime2,
      },
      {
        id: uuidB,
        type: "flag",
        content: { type: "flag", flagType: "needs_review" },
        createdBy: uuidA,
        createdAt: isoTime,
        updatedAt: isoTime2,
      },
    ];
    expect(zExperimentAnnotationList.parse(annotations)).toEqual(annotations);
  });

  it("zExperimentAnnotationPathParam valid", () => {
    const params = { id: uuidA, annotationId: uuidB };
    expect(zExperimentAnnotationPathParam.parse(params)).toEqual(params);
  });

  it("zExperimentAddAnnotationBody valid", () => {
    const body = {
      tableName: "sensor_data",
      rowId: "row-123",
      annotation: {
        type: "comment",
        content: { type: "comment", text: "Great data point!" },
      },
    };
    expect(zExperimentAddAnnotationBody.parse(body)).toEqual(body);
  });

  it("zExperimentAddAnnotationBody rejects empty rowId", () => {
    const body = {
      tableName: "sensor_data",
      rowId: "",
      annotation: {
        type: "comment",
        content: { type: "comment", text: "Test" },
      },
    };
    expect(() => zExperimentAddAnnotationBody.parse(body)).toThrow();
  });

  it("zExperimentAddAnnotationsBulkBody valid", () => {
    const body = {
      tableName: "sensor_data",
      rowIds: ["row-1", "row-2", "row-3"],
      annotation: {
        type: "flag",
        content: { type: "flag", flagType: "outlier", text: "All outliers" },
      },
    };
    expect(zExperimentAddAnnotationsBulkBody.parse(body)).toEqual(body);
  });

  it("zExperimentAddAnnotationsBulkBody rejects empty rowIds array", () => {
    const body = {
      tableName: "sensor_data",
      rowIds: [],
      annotation: {
        type: "comment",
        content: { type: "comment", text: "Test" },
      },
    };
    expect(() => zExperimentAddAnnotationsBulkBody.parse(body)).toThrow();
  });

  it("zExperimentListAnnotationsQuery valid with all fields", () => {
    const query = { page: 2, pageSize: 50, tableName: "measurements" };
    expect(zExperimentListAnnotationsQuery.parse(query)).toEqual(query);
  });

  it("zExperimentListAnnotationsQuery valid with just tableName", () => {
    const query = { tableName: "sensor_data" };
    expect(zExperimentListAnnotationsQuery.parse(query)).toEqual(query);
  });

  it("zExperimentListAnnotationsQuery coerces string numbers", () => {
    const query = { page: "3", pageSize: "25", tableName: "data" };
    const parsed = zExperimentListAnnotationsQuery.parse(query);
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(25);
    expect(parsed.tableName).toBe("data");
  });

  it("zExperimentUpdateAnnotationBody valid", () => {
    const body = {
      content: { type: "comment", text: "Updated comment text" },
    };
    expect(zExperimentUpdateAnnotationBody.parse(body)).toEqual(body);
  });

  it("zExperimentAnnotationDeleteBulkPathParam valid", () => {
    const params = { id: uuidA };
    expect(zExperimentAnnotationDeleteBulkPathParam.parse(params)).toEqual(params);
  });

  it("zExperimentAnnotationDeleteBulkBody valid", () => {
    const body = {
      tableName: "measurements",
      rowIds: ["row-1", "row-2"],
      type: "flag",
    };
    expect(zExperimentAnnotationDeleteBulkBody.parse(body)).toEqual(body);
  });

  it("zExperimentAnnotationDeleteBulkBody rejects empty rowIds", () => {
    const body = {
      tableName: "measurements",
      rowIds: [],
      type: "comment",
    };
    expect(() => zExperimentAnnotationDeleteBulkBody.parse(body)).toThrow();
  });

  it("zExperimentAnnotationRowsAffected valid", () => {
    const result = { rowsAffected: 5 };
    expect(zExperimentAnnotationRowsAffected.parse(result)).toEqual(result);
  });

  it("zExperimentAnnotationRowsAffected rejects non-integer", () => {
    expect(() => zExperimentAnnotationRowsAffected.parse({ rowsAffected: 3.14 })).toThrow();
  });
});
