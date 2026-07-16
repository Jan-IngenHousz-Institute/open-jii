import { renderHook, act, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDownloadExport } from "./useDownloadExport";

const { downloadExport } = vi.hoisted(() => ({ downloadExport: vi.fn() }));

vi.mock("@/lib/orpc", () => ({
  orpcClient: {
    experiments: {
      downloadExport,
    },
  },
}));

describe("useDownloadExport", () => {
  const experimentId = "exp-123";

  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn().mockReturnValue("blob:test-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return downloadExport, isDownloading, and downloadingExportId", () => {
    const { result } = renderHook(() => useDownloadExport(experimentId));

    expect(result.current.downloadExport).toBeDefined();
    expect(typeof result.current.downloadExport).toBe("function");
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.downloadingExportId).toBeUndefined();
  });

  it("calls the endpoint and triggers a download using the file name", async () => {
    const file = new File(["test data"], "export-456.csv", { type: "text/csv" });
    downloadExport.mockResolvedValue(file);

    const mockLink = { href: "", download: "", click: vi.fn() };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tag: string, options?: ElementCreationOptions) => {
        if (tag === "a") return mockLink as unknown as HTMLAnchorElement;
        return originalCreateElement(tag, options);
      },
    );
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

    const { result } = renderHook(() => useDownloadExport(experimentId));

    act(() => {
      result.current.downloadExport("export-456");
    });

    await waitFor(() => {
      expect(downloadExport).toHaveBeenCalledWith({ id: experimentId, exportId: "export-456" });
    });

    await waitFor(() => {
      expect(document.createElement).toHaveBeenCalledWith("a");
      expect(mockLink.href).toBe("blob:test-url");
      expect(mockLink.download).toBe("export-456.csv");
      expect(mockLink.click).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
    });
  });

  it("falls back to a generated name when the file has no name", async () => {
    const file = new File(["test data"], "");
    downloadExport.mockResolvedValue(file);

    const mockLink = { href: "", download: "", click: vi.fn() };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tag: string, options?: ElementCreationOptions) => {
        if (tag === "a") return mockLink as unknown as HTMLAnchorElement;
        return originalCreateElement(tag, options);
      },
    );
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

    const { result } = renderHook(() => useDownloadExport(experimentId));

    act(() => {
      result.current.downloadExport("789");
    });

    await waitFor(() => {
      expect(mockLink.download).toBe("export-789");
    });
  });

  it("does not create a download link when the request fails", async () => {
    downloadExport.mockRejectedValue(new Error("Not Found"));
    const createElementSpy = vi.spyOn(document, "createElement");

    const { result } = renderHook(() => useDownloadExport(experimentId));

    act(() => {
      result.current.downloadExport("export-999");
    });

    await waitFor(() => {
      expect(downloadExport).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.isDownloading).toBe(false);
    });

    expect(createElementSpy).not.toHaveBeenCalledWith("a");
  });
});
