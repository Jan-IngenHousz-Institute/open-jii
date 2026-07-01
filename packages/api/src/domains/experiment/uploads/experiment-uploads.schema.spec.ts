import { describe, expect, it } from "vitest";

import {
  inferUploadSourceKind,
  UPLOAD_FILENAME_SCHEMAS,
  UPLOAD_KIND_CONSTANTS,
  zExperimentAmbyteFilename,
  zExperimentCsvFilename,
  zExperimentJsonFilename,
  zExperimentNdjsonFilename,
  zExperimentParquetFilename,
  zExperimentTsvFilename,
  zExperimentUploadMetadata,
  zExperimentUploadSourceKind,
  zExperimentUploadTableName,
  zExperimentUploadTargetTable,
  zExperimentXlsxFilename,
} from "./experiment-uploads.schema";

const uuidA = "11111111-1111-1111-1111-111111111111";
const uuidB = "22222222-2222-2222-2222-222222222222";
const uuidC = "33333333-3333-3333-3333-333333333333";
const isoTime = "2024-01-15T10:00:00Z";
const isoTime2 = "2024-01-15T11:00:00Z";

describe("Upload schemas", () => {
  describe("zExperimentUploadSourceKind", () => {
    it("accepts all supported kinds", () => {
      expect(zExperimentUploadSourceKind.safeParse("ambyte").success).toBe(true);
      expect(zExperimentUploadSourceKind.safeParse("csv").success).toBe(true);
      expect(zExperimentUploadSourceKind.safeParse("tsv").success).toBe(true);
      expect(zExperimentUploadSourceKind.safeParse("parquet").success).toBe(true);
      expect(zExperimentUploadSourceKind.safeParse("xlsx").success).toBe(true);
      expect(zExperimentUploadSourceKind.safeParse("json").success).toBe(true);
      expect(zExperimentUploadSourceKind.safeParse("ndjson").success).toBe(true);
    });

    it("rejects unknown kinds", () => {
      expect(zExperimentUploadSourceKind.safeParse("orc").success).toBe(false);
      expect(zExperimentUploadSourceKind.safeParse("").success).toBe(false);
    });
  });

  describe("zExperimentUploadTableName", () => {
    it("accepts ASCII identifier shape", () => {
      expect(zExperimentUploadTableName.safeParse("leaf_traits").success).toBe(true);
      expect(zExperimentUploadTableName.safeParse("Table1").success).toBe(true);
      expect(zExperimentUploadTableName.safeParse("a").success).toBe(true);
    });

    it("rejects names that don't start with a letter", () => {
      expect(zExperimentUploadTableName.safeParse("1table").success).toBe(false);
      expect(zExperimentUploadTableName.safeParse("_table").success).toBe(false);
    });

    it("rejects names with non-identifier characters", () => {
      expect(zExperimentUploadTableName.safeParse("table-name").success).toBe(false);
      expect(zExperimentUploadTableName.safeParse("table name").success).toBe(false);
      expect(zExperimentUploadTableName.safeParse("table.name").success).toBe(false);
    });

    it("rejects names longer than 63 characters", () => {
      expect(zExperimentUploadTableName.safeParse("a".repeat(63)).success).toBe(true);
      expect(zExperimentUploadTableName.safeParse("a".repeat(64)).success).toBe(false);
    });

    it("rejects empty names", () => {
      expect(zExperimentUploadTableName.safeParse("").success).toBe(false);
    });
  });

  describe("zExperimentUploadTargetTable", () => {
    it("accepts a 'new' target with a valid name", () => {
      const result = zExperimentUploadTargetTable.safeParse({ kind: "new", name: "leaf_traits" });
      expect(result.success).toBe(true);
    });

    it("accepts an 'existing' target with a valid uploadTableId UUID", () => {
      const result = zExperimentUploadTargetTable.safeParse({
        kind: "existing",
        uploadTableId: "11111111-1111-1111-1111-111111111111",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an 'existing' target with a non-UUID uploadTableId", () => {
      expect(
        zExperimentUploadTargetTable.safeParse({ kind: "existing", uploadTableId: "leaf_traits" })
          .success,
      ).toBe(false);
    });

    it("rejects an invalid kind", () => {
      expect(zExperimentUploadTargetTable.safeParse({ kind: "other", name: "x" }).success).toBe(
        false,
      );
    });

    it("rejects when name fails identifier validation", () => {
      expect(zExperimentUploadTargetTable.safeParse({ kind: "new", name: "1bad" }).success).toBe(
        false,
      );
    });
  });

  describe("zExperimentCsvFilename", () => {
    it("returns the basename for a path-prefixed CSV", () => {
      const result = zExperimentCsvFilename.safeParse("some/dir/data.csv");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("data.csv");
      }
    });

    it("accepts a bare CSV filename", () => {
      const result = zExperimentCsvFilename.safeParse("data.csv");
      expect(result.success).toBe(true);
    });

    it("rejects non-CSV extensions", () => {
      expect(zExperimentCsvFilename.safeParse("data.txt").success).toBe(false);
      expect(zExperimentCsvFilename.safeParse("data").success).toBe(false);
    });

    it("rejects oversize names", () => {
      expect(zExperimentCsvFilename.safeParse("a".repeat(257) + ".csv").success).toBe(false);
    });
  });

  describe("zExperimentTsvFilename", () => {
    it("accepts a bare TSV filename", () => {
      expect(zExperimentTsvFilename.safeParse("data.tsv").success).toBe(true);
    });

    it("rejects non-TSV extensions", () => {
      expect(zExperimentTsvFilename.safeParse("data.csv").success).toBe(false);
    });
  });

  describe("zExperimentParquetFilename", () => {
    it("accepts a bare parquet filename", () => {
      expect(zExperimentParquetFilename.safeParse("data.parquet").success).toBe(true);
    });

    it("rejects non-parquet extensions", () => {
      expect(zExperimentParquetFilename.safeParse("data.csv").success).toBe(false);
    });
  });

  describe("zExperimentXlsxFilename", () => {
    it("accepts .xlsx and .xls", () => {
      expect(zExperimentXlsxFilename.safeParse("data.xlsx").success).toBe(true);
      expect(zExperimentXlsxFilename.safeParse("data.xls").success).toBe(true);
    });

    it("rejects non-Excel extensions", () => {
      expect(zExperimentXlsxFilename.safeParse("data.csv").success).toBe(false);
    });
  });

  describe("zExperimentJsonFilename", () => {
    it("accepts a bare JSON filename", () => {
      expect(zExperimentJsonFilename.safeParse("data.json").success).toBe(true);
    });

    it("rejects non-JSON extensions", () => {
      expect(zExperimentJsonFilename.safeParse("data.ndjson").success).toBe(false);
      expect(zExperimentJsonFilename.safeParse("data.csv").success).toBe(false);
    });
  });

  describe("zExperimentNdjsonFilename", () => {
    it("accepts .ndjson and .jsonl", () => {
      expect(zExperimentNdjsonFilename.safeParse("data.ndjson").success).toBe(true);
      expect(zExperimentNdjsonFilename.safeParse("data.jsonl").success).toBe(true);
    });

    it("rejects non-NDJSON extensions", () => {
      expect(zExperimentNdjsonFilename.safeParse("data.json").success).toBe(false);
      expect(zExperimentNdjsonFilename.safeParse("data.csv").success).toBe(false);
    });
  });

  describe("inferUploadSourceKind", () => {
    it.each([
      ["a.csv", "csv"],
      ["a.CSV", "csv"],
      ["a.tsv", "tsv"],
      ["a.parquet", "parquet"],
      ["a.xlsx", "xlsx"],
      ["a.xls", "xlsx"],
      ["a.json", "json"],
      ["a.ndjson", "ndjson"],
      ["a.jsonl", "ndjson"],
      ["a.txt", "ambyte"],
    ] as const)("infers %s → %s", (filename, expected) => {
      expect(inferUploadSourceKind(filename)).toBe(expected);
    });

    it("returns null for unsupported extensions", () => {
      expect(inferUploadSourceKind("a.orc")).toBeNull();
      expect(inferUploadSourceKind("a")).toBeNull();
    });
  });

  describe("zExperimentAmbyteFilename", () => {
    it("transforms a pathed Ambyte_N file to the trimmed tail", () => {
      const result = zExperimentAmbyteFilename.safeParse("uploads/Ambyte_5/data.txt");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("Ambyte_5/data.txt");
      }
    });

    it("transforms a pathed Ambyte_N/[1-4]/file.txt to the 3-segment tail", () => {
      const result = zExperimentAmbyteFilename.safeParse("prefix/Ambyte_12/3/some.txt");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("Ambyte_12/3/some.txt");
      }
    });

    it("buckets a bare timestamp filename under unknown_ambyte/unknown_ambit", () => {
      const result = zExperimentAmbyteFilename.safeParse("20260101-120000_.txt");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("unknown_ambyte/unknown_ambit/20260101-120000_.txt");
      }
    });

    it("buckets a generic bare .txt under unknown_ambyte", () => {
      const result = zExperimentAmbyteFilename.safeParse("anything.txt");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("unknown_ambyte/anything.txt");
      }
    });

    it("rejects non-.txt files", () => {
      expect(zExperimentAmbyteFilename.safeParse("Ambyte_1/data.csv").success).toBe(false);
    });

    it("rejects pathed files that don't match the Ambyte_N tail shape", () => {
      expect(zExperimentAmbyteFilename.safeParse("something/else/data.txt").success).toBe(false);
    });
  });

  describe("UPLOAD_KIND_CONSTANTS + UPLOAD_FILENAME_SCHEMAS", () => {
    const expectedKinds = ["ambyte", "csv", "json", "ndjson", "parquet", "tsv", "xlsx"];

    it("has matching keys for every supported kind", () => {
      expect(Object.keys(UPLOAD_KIND_CONSTANTS).sort()).toEqual(expectedKinds);
      expect(Object.keys(UPLOAD_FILENAME_SCHEMAS).sort()).toEqual(expectedKinds);
    });

    it("every kind lands in the unified 'uploads' volume", () => {
      for (const kind of expectedKinds as (keyof typeof UPLOAD_KIND_CONSTANTS)[]) {
        expect(UPLOAD_KIND_CONSTANTS[kind].volumeSourceType).toBe("uploads");
      }
    });

    it("respects the 5 GiB ceiling — every kind maxFileSize is well below", () => {
      const fiveGib = 5 * 1024 * 1024 * 1024;
      for (const kind of expectedKinds as (keyof typeof UPLOAD_KIND_CONSTANTS)[]) {
        expect(UPLOAD_KIND_CONSTANTS[kind].maxFileSize).toBeLessThan(fiveGib);
      }
    });
  });

  describe("zExperimentUploadMetadata", () => {
    const valid = {
      uploadId: "upload-1",
      experimentId: "exp-1",
      uploadTableId: "11111111-1111-1111-1111-111111111111",
      uploadTableName: "leaf_traits",
      sourceKind: "csv" as const,
      status: "completed" as const,
      fileCount: 2,
      rowCount: 100,
      createdBy: "user-1",
      createdAt: "2026-01-01T00:00:00Z",
      completedAt: "2026-01-01T00:05:00Z",
      errorMessage: null,
    };

    it("accepts a fully-populated completed record", () => {
      expect(zExperimentUploadMetadata.safeParse(valid).success).toBe(true);
    });

    it("accepts null uploadTableId / uploadTableName / row counts / completedAt / errorMessage", () => {
      const result = zExperimentUploadMetadata.safeParse({
        ...valid,
        uploadTableId: null,
        uploadTableName: null,
        fileCount: null,
        rowCount: null,
        completedAt: null,
        errorMessage: null,
      });
      expect(result.success).toBe(true);
    });

    it("rejects unknown status values", () => {
      expect(zExperimentUploadMetadata.safeParse({ ...valid, status: "halfway" }).success).toBe(
        false,
      );
    });
  });
});
