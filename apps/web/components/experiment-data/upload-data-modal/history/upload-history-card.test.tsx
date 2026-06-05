import { render, screen } from "@/test/test-utils";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { UploadMetadata } from "@repo/api/schemas/experiment.schema";

import { UploadHistoryCard } from "./upload-history-card";

// Radix's tooltip renders no distinguishing DOM in jsdom (trigger is a
// passthrough, content is a portal that only mounts on open). Mock the
// primitives so the wrapping decision is observable.
vi.mock("@repo/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

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
  it("renders the plain card body when not failed", () => {
    render(<UploadHistoryCard upload={baseUpload()} index={1} />);
    expect(screen.getByText("leaf_traits")).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
  });

  it("wraps the card in a tooltip showing the error message when failed", () => {
    render(
      <UploadHistoryCard
        upload={baseUpload({ status: "failed", errorMessage: "broke" })}
        index={1}
      />,
    );
    expect(screen.getByText("leaf_traits")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-content")).toHaveTextContent("broke");
  });

  it("does not wrap in a tooltip when failed without an error message", () => {
    render(
      <UploadHistoryCard upload={baseUpload({ status: "failed", errorMessage: null })} index={1} />,
    );
    expect(screen.getByText("leaf_traits")).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
  });
});
