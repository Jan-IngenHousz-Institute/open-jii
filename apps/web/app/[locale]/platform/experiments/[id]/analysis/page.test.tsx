import "@testing-library/jest-dom";
import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import AnalysisPage from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("AnalysisPage", () => {
  it("should redirect to visualizations page", async () => {
    const mockParams = Promise.resolve({ locale: "en", id: "exp-123" });

    await AnalysisPage({ params: mockParams });

    expect(redirect).toHaveBeenCalledWith(
      "/en/platform/experiments/exp-123/analysis/visualizations",
    );
  });

  it("should handle different locale", async () => {
    const mockParams = Promise.resolve({ locale: "de", id: "exp-456" });

    await AnalysisPage({ params: mockParams });

    expect(redirect).toHaveBeenCalledWith(
      "/de/platform/experiments/exp-456/analysis/visualizations",
    );
  });

  it("should construct correct path with experiment ID", async () => {
    const mockParams = Promise.resolve({ locale: "en", id: "test-experiment-789" });

    await AnalysisPage({ params: mockParams });

    expect(redirect).toHaveBeenCalledWith(
      "/en/platform/experiments/test-experiment-789/analysis/visualizations",
    );
  });

  it("should be called with correct redirect path format", async () => {
    const mockParams = Promise.resolve({ locale: "fr", id: "exp-999" });
    const mockRedirect = vi.mocked(redirect);

    await AnalysisPage({ params: mockParams });

    const redirectCall = mockRedirect.mock.calls[mockRedirect.mock.calls.length - 1]?.[0];
    expect(redirectCall).toContain("fr");
    expect(redirectCall).toContain("exp-999");
    expect(redirectCall).toContain("/platform/experiments/");
    expect(redirectCall).toContain("/analysis/visualizations");
  });
});
