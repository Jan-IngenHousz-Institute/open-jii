import { render, screen } from "@/test/test-utils";
import React from "react";
import { describe, expect, it } from "vitest";

import { UploadStatusBadge } from "./upload-status-badge";

describe("UploadStatusBadge", () => {
  it.each([
    ["pending" as const, "experimentData.uploadDataModal.history.status.pending"],
    ["running" as const, "experimentData.uploadDataModal.history.status.running"],
    ["completed" as const, "experimentData.uploadDataModal.history.status.completed"],
    ["failed" as const, "experimentData.uploadDataModal.history.status.failed"],
  ])("renders the %s label", (status, expectedLabel) => {
    render(<UploadStatusBadge status={status} />);
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });
});
