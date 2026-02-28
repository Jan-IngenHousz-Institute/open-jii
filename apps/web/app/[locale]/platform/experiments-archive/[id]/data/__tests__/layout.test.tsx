import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import DataLayout from "../layout";

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error, title }: { error: Error; title: string }) => (
    <div data-testid="error-display">
      <h2>{title}</h2>
      <p>{error.message}</p>
    </div>
  ),
}));

const mockParams = { id: "test-experiment-id", locale: "en-US" };

describe("<DataLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue(mockParams);
  });

  describe("Loading State", () => {
    it("shows loading message when data is loading", () => {
      server.mount(contract.experiments.getExperiment, { delay: "infinite" });

      render(
        <DataLayout params={Promise.resolve(mockParams)}>
          <div data-testid="child-content">Child Content</div>
        </DataLayout>,
      );

      expect(screen.getByText("loading")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error display when there is an error", async () => {
      server.mount(contract.experiments.getExperiment, { status: 500 });

      render(
        <DataLayout params={Promise.resolve(mockParams)}>
          <div data-testid="child-content">Child Content</div>
        </DataLayout>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toBeInTheDocument();
      });
      expect(screen.getByText("failedToLoad")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });
  });

  describe("Active State", () => {
    it("renders children when experiment status is active", async () => {
      server.mount(contract.experiments.getExperiment, {
        body: createExperiment({ id: "test-experiment-id", status: "active" }),
      });

      render(
        <DataLayout params={Promise.resolve(mockParams)}>
          <div data-testid="child-content">Child Content</div>
        </DataLayout>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("child-content")).toBeInTheDocument();
      });
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders children when experiment status is completed", async () => {
      server.mount(contract.experiments.getExperiment, {
        body: createExperiment({ id: "test-experiment-id", status: "completed" }),
      });

      render(
        <DataLayout params={Promise.resolve(mockParams)}>
          <div data-testid="child-content">Child Content</div>
        </DataLayout>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("child-content")).toBeInTheDocument();
      });
    });

    it("renders children when experiment status is unknown", async () => {
      server.mount(contract.experiments.getExperiment, {
        body: createExperiment({ id: "test-experiment-id", status: "unknown" }),
      });

      render(
        <DataLayout params={Promise.resolve(mockParams)}>
          <div data-testid="child-content">Child Content</div>
        </DataLayout>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("child-content")).toBeInTheDocument();
      });
    });
  });

  describe("Hook Integration", () => {
    it("calls use function with params promise", async () => {
      server.mount(contract.experiments.getExperiment, {
        body: createExperiment({ id: "test-experiment-id" }),
      });

      render(
        <DataLayout params={Promise.resolve(mockParams)}>
          <div data-testid="child-content">Child Content</div>
        </DataLayout>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("child-content")).toBeInTheDocument();
      });
      expect(vi.mocked(use)).toHaveBeenCalledWith(expect.any(Promise));
    });
  });
});
