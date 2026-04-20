import { redirect } from "next/navigation";
import { vi, describe, it, expect } from "vitest";

import AnalysisPage from "./page";

describe("<AnalysisPage />", () => {
  it("redirects to visualizations page with correct archive path", async () => {
    const params = Promise.resolve({ locale: "en-US", id: "test-experiment-id" });

    await AnalysisPage({ params });

    expect(vi.mocked(redirect)).toHaveBeenCalledWith(
      "/en-US/platform/experiments-archive/test-experiment-id/analysis/visualizations",
    );
  });

  it("redirects with different locale", async () => {
    const params = Promise.resolve({ locale: "de-DE", id: "another-experiment" });

    await AnalysisPage({ params });

    expect(vi.mocked(redirect)).toHaveBeenCalledWith(
      "/de-DE/platform/experiments-archive/another-experiment/analysis/visualizations",
    );
  });
});
