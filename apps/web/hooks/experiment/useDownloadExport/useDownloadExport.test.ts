import { renderHook, act, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDownloadExport } from "./useDownloadExport";

// Mock env
vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_API_URL: "http://localhost:3020",
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

  it("should fetch the correct URL with credentials and trigger download", async () => {
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

    const mockLink = {
      href: "",
      download: "",
      click: vi.fn(),
    };
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
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `http://localhost:3020/api/v1/experiments/${experimentId}/data/exports/export-456`,
        { credentials: "include" },
      );
    });

    await waitFor(() => {
      expect(document.createElement).toHaveBeenCalledWith("a");
      expect(mockLink.href).toBe("blob:test-url");
      expect(mockLink.download).toBe("export-456.csv");
      expect(mockLink.click).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
    });
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

  it("should not create download link when response is not ok", async () => {
    const mockResponse = {
      ok: false,
      statusText: "Not Found",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as never);
    const createElementSpy = vi.spyOn(document, "createElement");

    const { result } = renderHook(() => useDownloadExport(experimentId));

    act(() => {
      result.current.downloadExport("export-999");
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    // Wait for mutation to settle
    await waitFor(() => {
      expect(result.current.isDownloading).toBe(false);
    });

    // Download link should not have been created
    expect(createElementSpy).not.toHaveBeenCalledWith("a");
  });
});
