import { describe, expect, it } from "vitest";

import { zUpdateExperimentBody } from "../experiment.schema";
import {
  zExperimentExportDownloadLinksResponse,
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

const completedRecord = {
  exportId: uuidA,
  experimentId: uuidB,
  tableName: "raw_data",
  format: "parquet",
  status: "completed",
  rowCount: 2_500_000,
  totalBytes: 2_000_000_000,
  partCount: 3,
  errorCode: null,
  createdBy: uuidC,
  createdAt: isoTime,
  completedAt: isoTime2,
  expiresAt: "2024-02-14T10:00:00Z",
};

const runningRecord = {
  ...completedRecord,
  status: "running",
  rowCount: null,
  totalBytes: null,
  partCount: null,
  completedAt: null,
  expiresAt: null,
};

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

  it("zExperimentInitiateExportResponse is the created export's record", () => {
    expect(zExperimentInitiateExportResponse.parse(runningRecord)).toEqual(runningRecord);
  });

  it("zExperimentListExportsQuery valid", () => {
    const q = { tableName: "raw_data" };
    expect(zExperimentListExportsQuery.parse(q)).toEqual(q);
  });

  it("zExperimentListExportsQuery rejects missing tableName", () => {
    expect(() => zExperimentListExportsQuery.parse({})).toThrow();
  });

  it("zExperimentExportRecord accepts a completed record", () => {
    expect(zExperimentExportRecord.parse(completedRecord)).toEqual(completedRecord);
  });

  it("zExperimentExportRecord accepts an unfinished record without sizes", () => {
    expect(zExperimentExportRecord.parse(runningRecord)).toEqual(runningRecord);
  });

  it("zExperimentExportRecord requires an export id", () => {
    expect(() => zExperimentExportRecord.parse({ ...runningRecord, exportId: null })).toThrow();
  });

  it("zExperimentExportRecord accepts all valid statuses", () => {
    for (const status of [
      "queued",
      "pending",
      "running",
      "completed",
      "failed",
      "expired",
    ] as const) {
      expect(zExperimentExportRecord.parse({ ...runningRecord, status })).toEqual({
        ...runningRecord,
        status,
      });
    }
  });

  it("zExperimentExportRecord carries the reason a failed export gives", () => {
    const failed = { ...runningRecord, status: "failed", errorCode: "too_many_rows_for_format" };
    expect(zExperimentExportRecord.parse(failed)).toEqual(failed);
    expect(() => zExperimentExportRecord.parse({ ...failed, errorCode: "disk_full" })).toThrow();
  });

  it("zExperimentExportRecord rejects invalid status", () => {
    expect(() =>
      zExperimentExportRecord.parse({ ...runningRecord, status: "cancelled" }),
    ).toThrow();
  });

  it("zExperimentExportRecord rejects invalid format", () => {
    expect(() => zExperimentExportRecord.parse({ ...completedRecord, format: "xml" })).toThrow();
  });

  it("zExperimentListExportsResponse valid with exports", () => {
    const response = { exports: [runningRecord, completedRecord] };
    expect(zExperimentListExportsResponse.parse(response)).toEqual(response);
  });

  it("zExperimentListExportsResponse valid with empty exports", () => {
    const response = { exports: [] };
    expect(zExperimentListExportsResponse.parse(response)).toEqual(response);
  });

  it("zExperimentListExportsResponse rejects missing exports key", () => {
    expect(() => zExperimentListExportsResponse.parse({})).toThrow();
  });

  it("zExperimentExportDownloadLinksResponse lists one signed link per part", () => {
    const response = {
      parts: [
        {
          index: 0,
          fileName: "trial_raw_data_20240115_part-1-of-2.parquet",
          sizeBytes: 900,
          url: "https://bucket.s3.amazonaws.com/part-00000.parquet?X-Amz-Signature=abc",
        },
        {
          index: 1,
          fileName: "trial_raw_data_20240115_part-2-of-2.parquet",
          sizeBytes: 100,
          url: "https://bucket.s3.amazonaws.com/part-00001.parquet?X-Amz-Signature=def",
        },
      ],
      expiresAt: isoTime2,
    };
    expect(zExperimentExportDownloadLinksResponse.parse(response)).toEqual(response);
  });

  it("zExperimentExportDownloadLinksResponse rejects a part without a link", () => {
    const response = {
      parts: [{ index: 0, fileName: "a.csv.gz", sizeBytes: 1, url: "not a url" }],
      expiresAt: isoTime2,
    };
    expect(() => zExperimentExportDownloadLinksResponse.parse(response)).toThrow();
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
