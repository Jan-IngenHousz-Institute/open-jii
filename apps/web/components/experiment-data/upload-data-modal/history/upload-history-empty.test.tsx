import { render, screen } from "@/test/test-utils";
import React from "react";
import { describe, expect, it } from "vitest";

import { UploadHistoryEmpty } from "./upload-history-empty";

describe("UploadHistoryEmpty", () => {
  it("renders the empty-state copy", () => {
    render(<UploadHistoryEmpty />);
    expect(screen.getByText("experimentData.uploadDataModal.history.empty")).toBeInTheDocument();
  });
});
