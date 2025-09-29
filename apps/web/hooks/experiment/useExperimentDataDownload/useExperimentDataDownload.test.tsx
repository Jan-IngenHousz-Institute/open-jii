import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentDataDownload, useDownloadFile } from "./useExperimentDataDownload";

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
  });

  it("should call the downloadExperimentData query with correct parameters when enabled", async () => {
    const experimentId = "experiment-123";
    const tableName = "test_table";

    const mockResponse = {
      status: 200,
      body: {
        externalLinks: [
          {
            externalLink: "https://example.com/download/file1.csv",
            expiration: "2023-12-31T23:59:59Z",
            totalSize: 1024,
            rowCount: 100,
          },
          {
            externalLink: "https://example.com/download/file2.csv",
            expiration: "2023-12-31T23:59:59Z",
            totalSize: 2048,
            rowCount: 200,
          },
        ],
      },
    };

    // Setup the mock
    const queryMock = vi.fn().mockResolvedValue(mockResponse);
    vi.mocked(tsr.experiments.downloadExperimentData.query).mockImplementation(queryMock);

    const { result } = renderHook(() => useExperimentDataDownload(experimentId, tableName, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(queryMock).toHaveBeenCalledWith({
      params: { id: experimentId },
      query: { tableName },
    });

    expect(result.current.data).toEqual({
      data: mockResponse.body,
      tableName,
    });
  });

  it("should not fetch data when enabled is false", () => {
    const experimentId = "experiment-123";
    const tableName = "test_table";

    const queryMock = vi.fn();
    vi.mocked(tsr.experiments.downloadExperimentData.query).mockImplementation(queryMock);

    const { result } = renderHook(() => useExperimentDataDownload(experimentId, tableName, false), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("should handle errors when download fails", async () => {
    const experimentId = "experiment-123";
    const tableName = "test_table";

    // Setup the mock with error response
    const queryMock = vi.fn().mockResolvedValue({
      status: 500,
      body: {},
    });
    vi.mocked(tsr.experiments.downloadExperimentData.query).mockImplementation(queryMock);

    const { result } = renderHook(() => useExperimentDataDownload(experimentId, tableName, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(queryMock).toHaveBeenCalledWith({
      params: { id: experimentId },
      query: { tableName },
    });

    expect(result.current.error).toBeInstanceOf(Error);
    if (result.current.error) {
      expect(result.current.error.message).toBe("Failed to generate download links");
    }
  });

  it("should use correct query key", () => {
    const experimentId = "experiment-123";
    const tableName = "test_table";

    const queryMock = vi.fn().mockResolvedValue({
      status: 200,
      body: { externalLinks: [] },
    });
    vi.mocked(tsr.experiments.downloadExperimentData.query).mockImplementation(queryMock);

    renderHook(() => useExperimentDataDownload(experimentId, tableName, true), {
      wrapper: createWrapper(),
    });

    // Check that the query key is correct by inspecting the query cache
    const queries = queryClient.getQueryCache().getAll();
    expect(queries).toHaveLength(1);
    expect(queries[0]?.queryKey).toEqual(["downloadExperimentData", experimentId, tableName]);
  });
});

describe("useDownloadFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock DOM methods for download simulation
    global.document.createElement = vi.fn().mockImplementation(() => ({
      href: "",
      target: "",
      rel: "",
      click: vi.fn(),
    }));
    global.document.body.appendChild = vi.fn();
    global.document.body.removeChild = vi.fn();
  });

  it("should create download link and trigger click", () => {
    const url = "https://example.com/file.csv";
    const mockLink = {
      href: "",
      target: "",
      rel: "",
      click: vi.fn(),
    };

    const createElementMock = vi.fn().mockReturnValue(mockLink);
    const appendChildMock = vi.fn();
    const removeChildMock = vi.fn();

    global.document.createElement = createElementMock;
    global.document.body.appendChild = appendChildMock;
    global.document.body.removeChild = removeChildMock;

    const hook = useDownloadFile();

    hook.downloadFile(url);

    expect(createElementMock).toHaveBeenCalledWith("a");
    expect(mockLink.href).toBe(url);
    expect(mockLink.target).toBe("_blank");
    expect(mockLink.rel).toBe("noopener noreferrer");
    expect(appendChildMock).toHaveBeenCalledWith(mockLink);
    expect(mockLink.click).toHaveBeenCalled();
    expect(removeChildMock).toHaveBeenCalledWith(mockLink);
  });
});
