import { renderHook, act, waitFor } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentFilter } from "./useExperimentFilter";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

const mockUseRouter = useRouter as ReturnType<typeof vi.fn>;
const mockUseSearchParams = useSearchParams as ReturnType<typeof vi.fn>;

describe("useExperimentFilter", () => {
  let mockReplace: ReturnType<typeof vi.fn>;
  let mockSearchParams: URLSearchParams;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReplace = vi.fn();
    mockSearchParams = new URLSearchParams();

    mockUseRouter.mockReturnValue({
      replace: mockReplace,
    });

    mockUseSearchParams.mockReturnValue(mockSearchParams);
  });

  describe("filter initialization", () => {
    it("should default to 'member' when no filter param exists", () => {
      const { result } = renderHook(() => useExperimentFilter());

      expect(result.current.filter).toBe("member");
    });

    it("should return 'all' when filter param is 'all'", () => {
      mockSearchParams.set("filter", "all");
      mockUseSearchParams.mockReturnValue(mockSearchParams);

      const { result } = renderHook(() => useExperimentFilter());

      expect(result.current.filter).toBe("all");
    });

    it("should default to 'member' for invalid filter values", () => {
      mockSearchParams.set("filter", "invalid");
      mockUseSearchParams.mockReturnValue(mockSearchParams);

      const { result } = renderHook(() => useExperimentFilter());

      expect(result.current.filter).toBe("member");
    });

    it("should default to 'member' when filter is empty string", () => {
      mockSearchParams.set("filter", "");
      mockUseSearchParams.mockReturnValue(mockSearchParams);

      const { result } = renderHook(() => useExperimentFilter());

      expect(result.current.filter).toBe("member");
    });
  });

  describe("URL cleanup for invalid filters", () => {
    it("should clean up invalid filter from URL", async () => {
      mockSearchParams.set("filter", "invalid");
      mockUseSearchParams.mockReturnValue(mockSearchParams);

      renderHook(() => useExperimentFilter());

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(window.location.pathname, { scroll: false });
      });
    });

    it("should preserve other query params when cleaning up invalid filter", async () => {
      mockSearchParams.set("filter", "invalid");
      mockSearchParams.set("search", "test");
      mockUseSearchParams.mockReturnValue(mockSearchParams);

      renderHook(() => useExperimentFilter());

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("?search=test", { scroll: false });
      });
    });

    it("should not clean up when filter is 'all'", async () => {
      mockSearchParams.set("filter", "all");
      mockUseSearchParams.mockReturnValue(mockSearchParams);

      renderHook(() => useExperimentFilter());

      // Wait a bit to ensure no cleanup happens
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("should not clean up when filter is null", async () => {
      mockUseSearchParams.mockReturnValue(mockSearchParams);

      renderHook(() => useExperimentFilter());

      // Wait a bit to ensure no cleanup happens
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe("setFilter", () => {
    it("should set filter to 'all' in URL", () => {
      const { result } = renderHook(() => useExperimentFilter());

      act(() => {
        result.current.setFilter("all");
      });

      expect(mockReplace).toHaveBeenCalledWith("?filter=all", { scroll: false });
    });

    it("should remove filter param when set to 'member'", () => {
      mockSearchParams.set("filter", "all");
      mockUseSearchParams.mockReturnValue(mockSearchParams);

      const { result } = renderHook(() => useExperimentFilter());

      act(() => {
        result.current.setFilter("member");
      });

      expect(mockReplace).toHaveBeenCalledWith(window.location.pathname, { scroll: false });
    });

    it("should preserve other query params when setting filter", () => {
      mockSearchParams.set("search", "test");
      mockSearchParams.set("page", "2");
      mockUseSearchParams.mockReturnValue(mockSearchParams);

      const { result } = renderHook(() => useExperimentFilter());

      act(() => {
        result.current.setFilter("all");
      });

      expect(mockReplace).toHaveBeenCalledWith("?search=test&page=2&filter=all", {
        scroll: false,
      });
    });

    it("should preserve other query params when removing filter", () => {
      mockSearchParams.set("filter", "all");
      mockSearchParams.set("search", "test");
      mockUseSearchParams.mockReturnValue(mockSearchParams);

      const { result } = renderHook(() => useExperimentFilter());

      act(() => {
        result.current.setFilter("member");
      });

      expect(mockReplace).toHaveBeenCalledWith("?search=test", { scroll: false });
    });

    it("should handle toggling between filters", () => {
      const { result } = renderHook(() => useExperimentFilter());

      // Set to 'all'
      act(() => {
        result.current.setFilter("all");
      });

      expect(mockReplace).toHaveBeenCalledWith("?filter=all", { scroll: false });

      // Set back to 'member'
      act(() => {
        result.current.setFilter("member");
      });

      expect(mockReplace).toHaveBeenCalledWith(window.location.pathname, { scroll: false });
    });
  });

  describe("integration scenarios", () => {
    it("should handle cross-linking with ?filter=all", () => {
      mockSearchParams.set("filter", "all");
      mockUseSearchParams.mockReturnValue(mockSearchParams);

      const { result } = renderHook(() => useExperimentFilter());

      expect(result.current.filter).toBe("all");
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("should handle cross-linking with no filter param", () => {
      const { result } = renderHook(() => useExperimentFilter());

      expect(result.current.filter).toBe("member");
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("should handle malformed filter param gracefully", async () => {
      mockSearchParams.set("filter", "123!@#");
      mockUseSearchParams.mockReturnValue(mockSearchParams);

      const { result } = renderHook(() => useExperimentFilter());

      expect(result.current.filter).toBe("member");

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(window.location.pathname, { scroll: false });
      });
    });
  });
});
