import { randomUUID } from "crypto";

import type { ExperimentDataComment } from "@repo/api";

import type { SchemaData } from "../../../../common/modules/databricks/services/sql/sql.types";

export function addFakeCommentsColumns(schemaData: SchemaData) {
  // Add a fake comments column for demonstration purposes
  const testComment1: ExperimentDataComment = {
    text: "Test comment 1",
    createdBy: randomUUID(),
    createdByName: "Test User 1",
    createdAt: new Date().toISOString(),
  };
  const testComment2: ExperimentDataComment = {
    text: "Test comment 2",
    createdBy: randomUUID(),
    createdByName: "Test User 2",
    createdAt: new Date().toISOString(),
  };
  const testCommentFlag1: ExperimentDataComment = {
    text: "Test comment flag 1",
    flag: "outlier",
    createdBy: randomUUID(),
    createdByName: "Test User 1",
    createdAt: new Date().toISOString(),
  };
  const testCommentFlag2: ExperimentDataComment = {
    text: "Test comment flag 2",
    flag: "needs_review",
    createdBy: randomUUID(),
    createdByName: "Test User 2",
    createdAt: new Date().toISOString(),
  };

  schemaData.columns.unshift({
    name: "id",
    type_name: "ID",
    type_text: "ID",
  });
  schemaData.columns.push({
    name: "comments",
    type_name: "JSON_COMMENTS",
    type_text: "JSON_COMMENTS",
  });
  schemaData.rows.forEach((row) => {
    const id = randomUUID();
    row.unshift(id);
    const randomComment = Math.floor(Math.random() * (5 - 1 + 1)) + 1;
    switch (randomComment) {
      case 1:
        row.push(JSON.stringify([testComment1]));
        break;
      case 2:
        row.push(JSON.stringify([testComment1, testComment2]));
        break;
      case 3:
        row.push(JSON.stringify([testCommentFlag1, testComment2]));
        break;
      case 4:
        row.push(JSON.stringify([testCommentFlag1, testCommentFlag2]));
        break;
      default:
        row.push("[]");
    }
  });
}
