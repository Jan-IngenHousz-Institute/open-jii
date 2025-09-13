import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentDataDownload } from "./useExperimentDataDownload";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      downloadExperimentData: {
        query: vi.fn(),
      },
    },
  },
}));

describe("useExperimentDataDownload", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up DOM environment properly
    if (typeof document !== "undefined") {
      document.body.innerHTML = '<div id="test-container"></div>';
    }

    // Mock document methods for download simulation
    global.document.createElement = vi.fn().mockImplementation(() => ({
      href: "",
      download: "",
      target: "",
      rel: "",
      click: vi.fn(),
    }));
    global.document.body.appendChild = vi.fn();
    global.document.body.removeChild = vi.fn();
  });

  it("should call the downloadExperimentData query with correct parameters", async () => {
    const experimentId = "experiment-123";
    const tableName = "test_table";

    const mockResponse = {
      status: 200,
      body: {
        external_links: [
          {
            external_link: "https://example.com/download/file1.csv",
            expiration: "2023-12-31T23:59:59Z",
          },
          {
            external_link: "https://example.com/download/file2.csv",
            expiration: "2023-12-31T23:59:59Z",
          },
        ],
      },
    };

    // Setup the mock
    const queryMock = vi.fn().mockResolvedValue(mockResponse);
    vi.mocked(tsr.experiments.downloadExperimentData.query).mockImplementation(queryMock);

    const { result } = renderHook(() => useExperimentDataDownload(), {
      wrapper: createWrapper(),
      container: document.getElementById("test-container") ?? document.body,
    });

    result.current.mutate({ experimentId, tableName });

    await waitFor(() => {
      expect(queryMock).toHaveBeenCalledWith({
        params: { id: experimentId },
        query: { tableName },
      });
    });
  });

  it("should create download links for each external link", async () => {
    const experimentId = "experiment-123";
    const tableName = "test_table";

    const mockResponse = {
      status: 200,
      body: {
        external_links: [
          {
            external_link: "https://example.com/download/file1.csv",
            expiration: "2023-12-31T23:59:59Z",
          },
          {
            external_link: "https://example.com/download/file2.csv",
            expiration: "2023-12-31T23:59:59Z",
          },
        ],
      },
    };

    // Setup the mock
    const queryMock = vi.fn().mockResolvedValue(mockResponse);
    vi.mocked(tsr.experiments.downloadExperimentData.query).mockImplementation(queryMock);

    const createElement = vi.fn().mockImplementation(() => ({
      href: "",
      download: "",
      target: "",
      rel: "",
      click: vi.fn(),
    }));
    const appendChild = vi.fn();
    const removeChild = vi.fn();

    Object.defineProperty(document, "createElement", { value: createElement });
    Object.defineProperty(document.body, "appendChild", { value: appendChild });
    Object.defineProperty(document.body, "removeChild", { value: removeChild });

    const { result } = renderHook(() => useExperimentDataDownload(), {
      wrapper: createWrapper(),
      container: document.getElementById("test-container") ?? document.body,
    });

    result.current.mutate({ experimentId, tableName });

    await waitFor(() => {
      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(createElement).toHaveBeenCalledTimes(2);
      expect(appendChild).toHaveBeenCalledTimes(2);
      expect(removeChild).toHaveBeenCalledTimes(2);
    });
  });

  it("should handle errors when download fails", async () => {
    const experimentId = "experiment-123";
    const tableName = "test_table";
    const errorMessage = "Failed to generate download links";

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    // Setup the mock with error response
    const queryMock = vi.fn().mockResolvedValue({
      status: 500,
      body: {},
    });
    vi.mocked(tsr.experiments.downloadExperimentData.query).mockImplementation(queryMock);

    const { result } = renderHook(() => useExperimentDataDownload(), {
      wrapper: createWrapper(),
      container: document.getElementById("test-container") ?? document.body,
    });

    result.current.mutate({ experimentId, tableName });

    await waitFor(() => {
      expect(queryMock).toHaveBeenCalledWith({
        params: { id: experimentId },
        query: { tableName },
      });
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toBe("Download failed:");

      // Check the error object
      const error = consoleErrorSpy.mock.calls[0][1] as Error;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(errorMessage);
    });

    consoleErrorSpy.mockRestore();
  });
});
