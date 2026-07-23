import { describe, expect, it } from "vitest";

import { zUpdateExperimentBody } from "../experiment.schema";
import {
  zExperimentDownloadExportResponse,
  zExperimentExportPathParam,
  zExperimentExportRecord,
  zExperimentInitiateExportBody,
  zExperimentInitiateExportResponse,
  zExperimentListExportsQuery,
  zExperimentListExportsResponse,
} from "./experiment-exports.schema";

const uuidA = "11111111-1111-1111-1111-111111111111";
const uuidB = "22222222-2222-2222-2222-222222222222";
const uuidC = "33333333-3333-3333-3333-333333333333";
const isoTime = "2024-01-15T10:00:00Z";
const isoTime2 = "2024-01-15T11:00:00Z";

describe("Export Data Schemas", () => {
  it("zExperimentInitiateExportBody accepts valid input", () => {
    const body = { tableName: "raw_data", format: "csv" };
    expect(zExperimentInitiateExportBody.parse(body)).toEqual(body);
  });

  it("zExperimentInitiateExportBody accepts all valid formats", () => {
    for (const format of ["csv", "ndjson", "json-array", "parquet", "xlsx"] as const) {
      expect(zExperimentInitiateExportBody.parse({ tableName: "t1", format })).toEqual({
        tableName: "t1",
        format,
      });
    }
  });

  it("zExperimentInitiateExportBody rejects invalid format", () => {
    expect(() => zExperimentInitiateExportBody.parse({ tableName: "t1", format: "xml" })).toThrow();
  });

  it("zExperimentInitiateExportBody rejects missing fields", () => {
    expect(() => zExperimentInitiateExportBody.parse({ tableName: "t1" })).toThrow();
    expect(() => zExperimentInitiateExportBody.parse({ format: "csv" })).toThrow();
    expect(() => zExperimentInitiateExportBody.parse({})).toThrow();
  });

  it("zExperimentInitiateExportResponse valid", () => {
    const res = { status: "pending" };
    expect(zExperimentInitiateExportResponse.parse(res)).toEqual(res);
  });

  it("zExperimentInitiateExportResponse rejects empty status", () => {
    expect(() => zExperimentInitiateExportResponse.parse({})).toThrow();
  });

  it("zExperimentListExportsQuery valid", () => {
    const q = { tableName: "raw_data" };
    expect(zExperimentListExportsQuery.parse(q)).toEqual(q);
  });

  it("zExperimentListExportsQuery rejects missing tableName", () => {
    expect(() => zExperimentListExportsQuery.parse({})).toThrow();
  });

  it("zExperimentExportRecord accepts complete record", () => {
    const record = {
      exportId: uuidA,
      experimentId: uuidB,
      tableName: "raw_data",
      format: "csv",
      status: "completed",
      filePath: "/path/to/file.csv",
      rowCount: 1000,
      fileSize: 50000,
      createdBy: uuidC,
      createdAt: isoTime,
      completedAt: isoTime2,
    };
    expect(zExperimentExportRecord.parse(record)).toEqual(record);
  });

  it("zExperimentExportRecord accepts nullable fields as null", () => {
    const record = {
      exportId: null,
      experimentId: uuidB,
      tableName: "raw_data",
      format: "ndjson",
      status: "running",
      filePath: null,
      rowCount: null,
      fileSize: null,
      createdBy: uuidC,
      createdAt: isoTime,
      completedAt: null,
    };
    expect(zExperimentExportRecord.parse(record)).toEqual(record);
  });

  it("zExperimentExportRecord accepts all valid statuses", () => {
    const base = {
      exportId: null,
      experimentId: uuidB,
      tableName: "t1",
      format: "csv",
      filePath: null,
      rowCount: null,
      fileSize: null,
      createdBy: uuidC,
      createdAt: isoTime,
      completedAt: null,
    };
    for (const status of ["queued", "pending", "running", "completed", "failed"] as const) {
      expect(zExperimentExportRecord.parse({ ...base, status })).toEqual({ ...base, status });
    }
  });

  it("zExperimentExportRecord rejects invalid status", () => {
    const record = {
      exportId: uuidA,
      experimentId: uuidB,
      tableName: "raw_data",
      format: "csv",
      status: "cancelled",
      filePath: null,
      rowCount: null,
      fileSize: null,
      createdBy: uuidC,
      createdAt: isoTime,
      completedAt: null,
    };
    expect(() => zExperimentExportRecord.parse(record)).toThrow();
  });

  it("zExperimentExportRecord rejects invalid format", () => {
    const record = {
      exportId: uuidA,
      experimentId: uuidB,
      tableName: "raw_data",
      format: "xml",
      status: "completed",
      filePath: null,
      rowCount: null,
      fileSize: null,
      createdBy: uuidC,
      createdAt: isoTime,
      completedAt: null,
    };
    expect(() => zExperimentExportRecord.parse(record)).toThrow();
  });

  it("zExperimentListExportsResponse valid with exports", () => {
    const response = {
      exports: [
        {
          exportId: uuidA,
          experimentId: uuidB,
          tableName: "raw_data",
          format: "csv",
          status: "completed",
          filePath: "/path/to/file.csv",
          rowCount: 100,
          fileSize: 5000,
          createdBy: uuidC,
          createdAt: isoTime,
          completedAt: isoTime2,
        },
      ],
    };
    expect(zExperimentListExportsResponse.parse(response)).toEqual(response);
  });

  it("zExperimentListExportsResponse valid with empty exports", () => {
    const response = { exports: [] };
    expect(zExperimentListExportsResponse.parse(response)).toEqual(response);
  });

  it("zExperimentListExportsResponse rejects missing exports key", () => {
    expect(() => zExperimentListExportsResponse.parse({})).toThrow();
  });

  it("zExperimentDownloadExportResponse accepts any value", () => {
    // z.unknown() accepts anything
    expect(zExperimentDownloadExportResponse.parse("binary data")).toBe("binary data");
    expect(zExperimentDownloadExportResponse.parse(null)).toBe(null);
    expect(zExperimentDownloadExportResponse.parse(42)).toBe(42);
  });
});

describe("anonymizeContributors on update/export bodies", () => {
  it("zUpdateExperimentBody accepts the new flag", () => {
    const body = { anonymizeContributors: true };
    expect(zUpdateExperimentBody.parse(body)).toEqual(body);
  });

  it("zExperimentInitiateExportBody accepts the per-export override", () => {
    const body = { tableName: "t", format: "csv" as const, anonymizeContributors: true };
    expect(zExperimentInitiateExportBody.parse(body)).toEqual(body);
  });
});
describe("zExperimentExportPathParam", () => {
  it("accepts valid ids and rejects a bad exportId", () => {
    const ok = { id: uuidA, exportId: uuidB };
    expect(zExperimentExportPathParam.parse(ok)).toEqual(ok);
    expect(() => zExperimentExportPathParam.parse({ id: uuidA, exportId: "nope" })).toThrow();
  });
});
