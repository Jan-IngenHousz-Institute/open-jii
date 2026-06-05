import { render, screen } from "@/test/test-utils";
import React from "react";
import { describe, expect, it } from "vitest";

import type { UploadMetadata } from "@repo/api/schemas/experiment.schema";

import { UploadHistoryContent } from "./upload-history-content";

function makeUpload(id: string, name: string): UploadMetadata {
  return {
    uploadId: id,
    experimentId: "exp-1",
    uploadTableId: "11111111-1111-1111-1111-111111111111",
    uploadTableName: name,
    sourceKind: "csv",
    status: "completed",
    fileCount: 1,
    rowCount: 10,
    createdBy: "user-1",
    createdAt: "2026-05-13T10:00:00.000Z",
    completedAt: "2026-05-13T10:05:00.000Z",
    errorMessage: null,
  };
}

describe("UploadHistoryContent", () => {
  it("renders the loading skeleton while loading", () => {
    const { container } = render(<UploadHistoryContent isLoading uploads={[]} />);
    expect(container.querySelectorAll('[class*="border-l-4"]')).toHaveLength(3);
  });

  it("renders the empty state when not loading and there are no uploads", () => {
    render(<UploadHistoryContent isLoading={false} uploads={[]} />);
    expect(screen.getByText("experimentData.uploadDataModal.history.empty")).toBeInTheDocument();
  });

  it("renders one card per upload", () => {
    render(
      <UploadHistoryContent
        isLoading={false}
        uploads={[makeUpload("u-1", "leaf_traits"), makeUpload("u-2", "soil_chem")]}
      />,
    );
    expect(screen.getByText("leaf_traits")).toBeInTheDocument();
    expect(screen.getByText("soil_chem")).toBeInTheDocument();
  });

  it("prefers the loading state even if uploads are present", () => {
    render(<UploadHistoryContent isLoading uploads={[makeUpload("u-1", "leaf_traits")]} />);
    expect(screen.queryByText("leaf_traits")).not.toBeInTheDocument();
  });
});
