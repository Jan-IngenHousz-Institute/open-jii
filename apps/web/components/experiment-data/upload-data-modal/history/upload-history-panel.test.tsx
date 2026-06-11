import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import React from "react";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { UploadHistoryPanel } from "./upload-history-panel";

describe("UploadHistoryPanel", () => {
  it("renders the empty state when the API returns no uploads", async () => {
    server.mount(contract.experiments.listUploads, { body: { uploads: [] } });

    render(<UploadHistoryPanel experimentId="exp-1" enabled />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.uploadDataModal.history.empty")).toBeInTheDocument();
    });
  });

  it("renders one card per upload returned by the API", async () => {
    server.mount(contract.experiments.listUploads, {
      body: {
        uploads: [
          {
            uploadId: "u-1",
            experimentId: "exp-1",
            uploadTableId: "11111111-1111-1111-1111-111111111111",
            uploadTableName: "leaf_traits",
            sourceKind: "csv",
            status: "completed",
            fileCount: 1,
            rowCount: 12,
            createdBy: "user-1",
            createdAt: "2026-05-13T10:00:00.000Z",
            completedAt: "2026-05-13T10:05:00.000Z",
            errorMessage: null,
          },
          {
            uploadId: "u-2",
            experimentId: "exp-1",
            uploadTableId: "22222222-2222-2222-2222-222222222222",
            uploadTableName: "soil_chem",
            sourceKind: "tsv",
            status: "failed",
            fileCount: null,
            rowCount: null,
            createdBy: "user-1",
            createdAt: "2026-05-13T11:00:00.000Z",
            completedAt: "2026-05-13T11:01:00.000Z",
            errorMessage: "boom",
          },
        ],
      },
    });

    render(<UploadHistoryPanel experimentId="exp-1" enabled />);

    await waitFor(() => {
      expect(screen.getByText("leaf_traits")).toBeInTheDocument();
    });
    expect(screen.getByText("soil_chem")).toBeInTheDocument();
    expect(
      screen.getByText("experimentData.uploadDataModal.history.uploadCount"),
    ).toBeInTheDocument();
  });

  it("filters uploads by uploadTableName when provided", async () => {
    const spy = server.mount(contract.experiments.listUploads, {
      body: { uploads: [] },
    });

    render(<UploadHistoryPanel experimentId="exp-1" enabled uploadTableName="leaf_traits" />);

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
    expect(spy.calls[0].query.uploadTableName).toBe("leaf_traits");
  });
});
