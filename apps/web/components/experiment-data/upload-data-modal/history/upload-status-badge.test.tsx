import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { zExperimentUploadStatus } from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";

import { UploadStatusBadge } from "./upload-status-badge";

describe("UploadStatusBadge", () => {
  it.each(zExperimentUploadStatus.options)("labels the %s status", (status) => {
    render(<UploadStatusBadge status={status} />);

    expect(screen.getByText(`experimentData.uploadDataModal.status.${status}`)).toBeInTheDocument();
  });

  it("spins its icon only while the upload runs", () => {
    const { container, rerender } = render(<UploadStatusBadge status="running" />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();

    rerender(<UploadStatusBadge status="queued" />);
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });
});
