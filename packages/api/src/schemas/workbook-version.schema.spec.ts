import { describe, it, expect } from "vitest";

import {
  zWorkbookVersion,
  zWorkbookVersionSummary,
  zWorkbookVersionList,
  zWorkbookVersionIdPathParam,
  zAttachWorkbookBody,
  zAttachWorkbookResponse,
} from "./workbook-version.schema";

const validUuid = "11111111-1111-1111-1111-111111111111";

describe("Workbook Version Schemas", () => {
  describe("zWorkbookVersion", () => {
    const valid = {
      id: validUuid,
      workbookId: validUuid,
      version: 1,
      cells: [],
      metadata: {},
      createdAt: "2025-06-01T00:00:00.000Z",
      createdBy: validUuid,
    };

    it("accepts a valid workbook version", () => {
      expect(zWorkbookVersion.safeParse(valid).success).toBe(true);
    });

    it("accepts version with cells", () => {
      const withCells = {
        ...valid,
        cells: [{ id: "c1", type: "markdown", content: "Hello", isCollapsed: false }],
      };
      expect(zWorkbookVersion.safeParse(withCells).success).toBe(true);
    });

    it("rejects version <= 0", () => {
      expect(zWorkbookVersion.safeParse({ ...valid, version: 0 }).success).toBe(false);
      expect(zWorkbookVersion.safeParse({ ...valid, version: -1 }).success).toBe(false);
    });

    it("rejects non-integer version", () => {
      expect(zWorkbookVersion.safeParse({ ...valid, version: 1.5 }).success).toBe(false);
    });

    it("rejects invalid uuid for workbookId", () => {
      expect(zWorkbookVersion.safeParse({ ...valid, workbookId: "not-uuid" }).success).toBe(false);
    });

    it("rejects missing createdBy", () => {
      const { createdBy: _, ...missing } = valid;
      expect(zWorkbookVersion.safeParse(missing).success).toBe(false);
    });
  });

  describe("zWorkbookVersionSummary", () => {
    const valid = {
      id: validUuid,
      workbookId: validUuid,
      version: 3,
      createdAt: "2025-06-01T00:00:00.000Z",
      createdBy: validUuid,
    };

    it("accepts a valid summary (no cells)", () => {
      expect(zWorkbookVersionSummary.safeParse(valid).success).toBe(true);
    });

    it("strips extra properties", () => {
      const result = zWorkbookVersionSummary.safeParse({ ...valid, cells: [] });
      expect(result.success).toBe(true);
    });
  });

  describe("zWorkbookVersionList", () => {
    it("accepts empty array", () => {
      expect(zWorkbookVersionList.safeParse([]).success).toBe(true);
    });

    it("accepts array of summaries", () => {
      const list = [
        {
          id: validUuid,
          workbookId: validUuid,
          version: 1,
          createdAt: "2025-06-01T00:00:00.000Z",
          createdBy: validUuid,
        },
      ];
      expect(zWorkbookVersionList.safeParse(list).success).toBe(true);
    });
  });

  describe("zWorkbookVersionIdPathParam", () => {
    it("accepts valid id + versionId", () => {
      const result = zWorkbookVersionIdPathParam.safeParse({
        id: validUuid,
        versionId: validUuid,
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing versionId", () => {
      expect(zWorkbookVersionIdPathParam.safeParse({ id: validUuid }).success).toBe(false);
    });
  });

  describe("zAttachWorkbookBody", () => {
    it("accepts valid workbookId", () => {
      expect(zAttachWorkbookBody.safeParse({ workbookId: validUuid }).success).toBe(true);
    });

    it("rejects non-uuid workbookId", () => {
      expect(zAttachWorkbookBody.safeParse({ workbookId: "abc" }).success).toBe(false);
    });

    it("rejects empty object", () => {
      expect(zAttachWorkbookBody.safeParse({}).success).toBe(false);
    });
  });

  describe("zAttachWorkbookResponse", () => {
    it("accepts valid response", () => {
      const result = zAttachWorkbookResponse.safeParse({
        workbookId: validUuid,
        workbookVersionId: validUuid,
        version: 1,
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing version", () => {
      const result = zAttachWorkbookResponse.safeParse({
        workbookId: validUuid,
        workbookVersionId: validUuid,
      });
      expect(result.success).toBe(false);
    });
  });
});
