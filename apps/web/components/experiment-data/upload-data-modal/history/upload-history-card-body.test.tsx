import { render, screen } from "@/test/test-utils";
import React from "react";
import { describe, expect, it } from "vitest";

import type { UploadMetadata } from "@repo/api/schemas/experiment.schema";

import { UploadHistoryCardBody } from "./upload-history-card-body";

function baseUpload(overrides?: Partial<UploadMetadata>): UploadMetadata {
  return {
    uploadId: "u-1",
    experimentId: "exp-1",
    uploadTableId: "11111111-1111-1111-1111-111111111111",
    uploadTableName: "leaf_traits",
    sourceKind: "csv",
    status: "completed",
    fileCount: 3,
    rowCount: 1234,
    createdBy: "user-1",
    createdAt: "2026-05-13T10:00:00.000Z",
    completedAt: "2026-05-13T10:05:00.000Z",
    errorMessage: null,
    ...overrides,
  };
}

describe("UploadHistoryCardBody", () => {
  it("renders the upload table name as the label", () => {
    render(<UploadHistoryCardBody upload={baseUpload()} index={1} />);
    expect(screen.getByText("leaf_traits")).toBeInTheDocument();
  });

  it("falls back to the 'untargeted' label when uploadTableName is null", () => {
    render(<UploadHistoryCardBody upload={baseUpload({ uploadTableName: null })} index={1} />);
    expect(
      screen.getByText("experimentData.uploadDataModal.history.untargeted"),
    ).toBeInTheDocument();
  });

  it("renders rowCount and fileCount labels when both are present", () => {
    render(<UploadHistoryCardBody upload={baseUpload()} index={1} />);
    expect(screen.getByText("experimentData.uploadDataModal.history.rowCount")).toBeInTheDocument();
    expect(
      screen.getByText("experimentData.uploadDataModal.history.fileCount"),
    ).toBeInTheDocument();
  });

  it("omits rowCount/fileCount labels when both are null", () => {
    render(
      <UploadHistoryCardBody upload={baseUpload({ rowCount: null, fileCount: null })} index={1} />,
    );
    expect(
      screen.queryByText("experimentData.uploadDataModal.history.rowCount"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("experimentData.uploadDataModal.history.fileCount"),
    ).not.toBeInTheDocument();
  });

  it("renders the status badge for the upload status", () => {
    render(<UploadHistoryCardBody upload={baseUpload({ status: "failed" })} index={1} />);
    expect(
      screen.getByText("experimentData.uploadDataModal.history.status.failed"),
    ).toBeInTheDocument();
  });
});
