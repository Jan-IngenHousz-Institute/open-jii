import { render, screen, userEvent } from "@/test/test-utils";
import React from "react";
import { describe, expect, it } from "vitest";

import type { ExperimentUploadMetadata } from "@repo/api/domains/experiment/experiment.schema";

import { UploadHistoryCard } from "./upload-history-card";

function baseUpload(overrides?: Partial<ExperimentUploadMetadata>): ExperimentUploadMetadata {
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
  it("renders the card and exposes no failure tooltip when not failed", async () => {
    render(<UploadHistoryCard upload={baseUpload()} index={1} />);
    expect(screen.getByText("leaf_traits")).toBeInTheDocument();
    await userEvent.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("reveals the error message in a tooltip on keyboard focus when failed", async () => {
    render(
      <UploadHistoryCard
        upload={baseUpload({ status: "failed", errorMessage: "broke" })}
        index={1}
      />,
    );
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("broke");
  });

  it("exposes no tooltip when failed without an error message", async () => {
    render(
      <UploadHistoryCard upload={baseUpload({ status: "failed", errorMessage: null })} index={1} />,
    );
    await userEvent.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
