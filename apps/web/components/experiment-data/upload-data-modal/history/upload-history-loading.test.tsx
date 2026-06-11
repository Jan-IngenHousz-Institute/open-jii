import { render } from "@/test/test-utils";
import React from "react";
import { describe, expect, it } from "vitest";

import { UploadHistoryLoading } from "./upload-history-loading";

describe("UploadHistoryLoading", () => {
  it("renders three skeleton rows mirroring the card layout", () => {
    const { container } = render(<UploadHistoryLoading />);
    const skeletonRows = container.querySelectorAll('[class*="border-l-4"]');
    expect(skeletonRows).toHaveLength(3);
  });
});
