import { createUpload } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
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
          createUpload({ uploadTableName: "leaf_traits", status: "completed" }),
          createUpload({
            uploadTableName: "soil_chem",
            sourceKind: "tsv",
            status: "failed",
            errorCode: "no_rows",
          }),
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
    expect(screen.getByText("experimentData.uploadDataModal.errors.no_rows")).toBeInTheDocument();
  });

  it("says the list could not be loaded instead of claiming there are no uploads", async () => {
    server.mount(contract.experiments.listUploads, {
      status: 500,
      body: { message: "Server error" },
    });

    render(<UploadHistoryPanel experimentId="exp-1" enabled />);

    expect(
      await screen.findByText("experimentData.uploadDataModal.history.error"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("experimentData.uploadDataModal.history.empty"),
    ).not.toBeInTheDocument();
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
