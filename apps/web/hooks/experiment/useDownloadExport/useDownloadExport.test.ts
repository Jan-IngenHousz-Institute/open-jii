import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDownloadExport } from "./useDownloadExport";

// Mock env
vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_API_URL: "http://localhost:3020",
  },
}));

// Mock @tanstack/react-query
const mockMutate = vi.fn();
let capturedMutationFn: ((exportId: string) => Promise<void>) | undefined;

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: { mutationFn: (exportId: string) => Promise<void> }) => {
    capturedMutationFn = options.mutationFn;
    return {
      mutate: mockMutate,
      isPending: false,
      variables: undefined,
    };
  },
}));

describe("useDownloadExport", () => {
  const experimentId = "exp-123";

  beforeEach(() => {
    vi.clearAllMocks();
    capturedMutationFn = undefined;
    URL.createObjectURL = vi.fn().mockReturnValue("blob:test-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return downloadExport, isDownloading, and downloadingExportId", () => {
    const { result } = renderHook(() => useDownloadExport(experimentId));

    expect(result.current.downloadExport).toBeDefined();
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.downloadingExportId).toBeUndefined();
  });

  it("should call mutate when downloadExport is invoked", () => {
    const { result } = renderHook(() => useDownloadExport(experimentId));

    act(() => {
      result.current.downloadExport("export-456");
    });

    expect(mockMutate).toHaveBeenCalledWith("export-456");
  });

  it("should fetch the correct URL with credentials", async () => {
    const mockBlob = new Blob(["test data"], { type: "text/csv" });
    const mockResponse = {
      ok: true,
      statusText: "OK",
      blob: vi.fn().mockResolvedValue(mockBlob),
      headers: {
        get: vi.fn().mockReturnValue('attachment; filename="export-456.csv"'),
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as never);

    renderHook(() => useDownloadExport(experimentId));

    expect(capturedMutationFn).toBeDefined();
    const exportId = "export-456";

    // Mock DOM methods for download
    const mockLink = {
      href: "",
      download: "",
      click: vi.fn(),
    };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

    if (capturedMutationFn) await capturedMutationFn(exportId);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `http://localhost:3020/api/v1/experiments/${experimentId}/data/exports/${exportId}`,
      { credentials: "include" },
    );

    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(mockLink.href).toBe("blob:test-url");
    expect(mockLink.download).toBe("export-456.csv");
    expect(mockLink.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });

  it("should use fallback filename when Content-Disposition is missing", async () => {
    const mockBlob = new Blob(["test data"]);
    const mockResponse = {
      ok: true,
      statusText: "OK",
      blob: vi.fn().mockResolvedValue(mockBlob),
      headers: {
        get: vi.fn().mockReturnValue(null),
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as never);

    renderHook(() => useDownloadExport(experimentId));

    const mockLink = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

    const exportId = "789";
    if (capturedMutationFn) await capturedMutationFn(exportId);

    expect(mockLink.download).toBe("export-789");
  });

  it("should throw error when response is not ok", async () => {
    const mockResponse = {
      ok: false,
      statusText: "Not Found",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as never);

    renderHook(() => useDownloadExport(experimentId));

    if (capturedMutationFn) {
      await expect(capturedMutationFn("export-999")).rejects.toThrow("Download failed: Not Found");
    }
  });
});
