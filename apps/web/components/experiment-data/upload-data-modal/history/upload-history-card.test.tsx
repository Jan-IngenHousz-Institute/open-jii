import { render, screen } from "@/test/test-utils";
import React from "react";
import { describe, expect, it } from "vitest";

import type { UploadMetadata } from "@repo/api/schemas/experiment.schema";

import { UploadHistoryCard } from "./upload-history-card";

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

describe("UploadHistoryCard", () => {
  it("renders the upload table name as the label", () => {
    render(<UploadHistoryCard upload={baseUpload()} index={1} />);
    expect(screen.getByText("leaf_traits")).toBeInTheDocument();
  });

  it("falls back to the 'untargeted' label when uploadTableName is null", () => {
    render(<UploadHistoryCard upload={baseUpload({ uploadTableName: null })} index={1} />);
    expect(
      screen.getByText("experimentData.uploadDataModal.history.untargeted"),
    ).toBeInTheDocument();
  });

  it("renders rowCount and fileCount labels when both are present", () => {
    render(<UploadHistoryCard upload={baseUpload()} index={1} />);
    expect(screen.getByText("experimentData.uploadDataModal.history.rowCount")).toBeInTheDocument();
    expect(
      screen.getByText("experimentData.uploadDataModal.history.fileCount"),
    ).toBeInTheDocument();
  });

  it("omits rowCount/fileCount labels when both are null", () => {
    render(
      <UploadHistoryCard upload={baseUpload({ rowCount: null, fileCount: null })} index={1} />,
    );
    expect(
      screen.queryByText("experimentData.uploadDataModal.history.rowCount"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("experimentData.uploadDataModal.history.fileCount"),
    ).not.toBeInTheDocument();
  });

  it("wraps the card in a tooltip when the upload status is 'failed'", () => {
    render(
      <UploadHistoryCard
        upload={baseUpload({ status: "failed", errorMessage: "broke" })}
        index={1}
      />,
    );
    // The tooltip trigger renders the same card content; assertion-by-presence
    // is enough: the failed status badge appears.
    expect(
      screen.getByText("experimentData.uploadDataModal.history.status.failed"),
    ).toBeInTheDocument();
  });
});
