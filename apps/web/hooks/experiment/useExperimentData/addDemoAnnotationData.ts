import { v4 as uuidv4 } from "uuid";
import { getAnnotationData } from "~/components/experiment-data/annotations/utils";

import type { Annotation, ExperimentData } from "@repo/api";

const testAnnotation1: Annotation = {
  id: uuidv4(),
  userId: uuidv4(),
  userName: "Test User 1",
  type: "comment",
  content: { text: "Test comment 1" },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const testAnnotation2: Annotation = {
  id: uuidv4(),
  userId: uuidv4(),
  userName: "Test User 2",
  type: "comment",
  content: { text: "Test comment 2" },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const testAnnotation3: Annotation = {
  id: uuidv4(),
  userId: testAnnotation1.userId,
  userName: "Test User 1",
  type: "flag",
  content: { flagType: "outlier", reason: "Test reason 1" },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const testAnnotation4: Annotation = {
  id: uuidv4(),
  userId: testAnnotation2.userId,
  userName: "Test User 2",
  type: "flag",
  content: { flagType: "needs_review", reason: "Test reason 2" },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function addDemoAnnotationData(data: ExperimentData) {
  if (!data.columns.find((column) => column.name === "id")) {
    data.columns.unshift({
      name: "id",
      type_name: "ID",
      type_text: "ID",
    });
    data.columns.unshift({
      name: "annotations",
      type_name: "ANNOTATIONS",
      type_text: "ANNOTATIONS",
    });
    data.rows.forEach((row) => {
      row.id = uuidv4();
      const randomComment = Math.floor(Math.random() * (5 - 1 + 1)) + 1;
      let annotations: Annotation[] = [];
      switch (randomComment) {
        case 1:
          annotations = [testAnnotation1];
          break;
        case 2:
          annotations = [testAnnotation1, testAnnotation2];
          break;
        case 3:
          annotations = [testAnnotation3, testAnnotation2];
          break;
        case 4:
          annotations = [testAnnotation3, testAnnotation4];
          break;
        default:
          annotations = [];
      }
      row.annotations = getAnnotationData(annotations);
    });
  }
}
