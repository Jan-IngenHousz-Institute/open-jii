import { createUpload } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { UploadHistoryContent } from "./upload-history-content";

describe("UploadHistoryContent", () => {
  it("shows neither the empty state nor cards while loading", () => {
    render(
      <UploadHistoryContent
        isLoading
        error={null}
        uploads={[createUpload({ uploadTableName: "leaf_traits" })]}
      />,
    );

    expect(
      screen.queryByText("experimentData.uploadDataModal.history.empty"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("leaf_traits")).not.toBeInTheDocument();
  });

  it("renders the empty state when not loading and there are no uploads", () => {
    render(<UploadHistoryContent isLoading={false} error={null} uploads={[]} />);

    expect(screen.getByText("experimentData.uploadDataModal.history.empty")).toBeInTheDocument();
  });

  it("renders the error instead of the empty state when the list failed to load", () => {
    render(<UploadHistoryContent isLoading={false} error={new Error("boom")} uploads={[]} />);

    expect(screen.getByText("experimentData.uploadDataModal.history.error")).toBeInTheDocument();
    expect(
      screen.queryByText("experimentData.uploadDataModal.history.empty"),
    ).not.toBeInTheDocument();
  });

  it("renders one card per upload", () => {
    render(
      <UploadHistoryContent
        isLoading={false}
        error={null}
        uploads={[
          createUpload({ uploadTableName: "leaf_traits" }),
          createUpload({ uploadTableName: "soil_chem" }),
        ]}
      />,
    );

    expect(screen.getByText("leaf_traits")).toBeInTheDocument();
    expect(screen.getByText("soil_chem")).toBeInTheDocument();
  });
});
