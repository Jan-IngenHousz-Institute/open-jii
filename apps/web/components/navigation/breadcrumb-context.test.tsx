import "@testing-library/jest-dom";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";

import { BreadcrumbProvider, useBreadcrumbContext } from "./breadcrumb-context";

describe("BreadcrumbContext", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <BreadcrumbProvider>{children}</BreadcrumbProvider>
  );

  describe("useBreadcrumbContext", () => {
    it("throws error when used outside BreadcrumbProvider", () => {
      expect(() => {
        renderHook(() => useBreadcrumbContext());
      }).toThrow("useBreadcrumbContext must be used within BreadcrumbProvider");
    });

    it("returns context when used inside BreadcrumbProvider", () => {
      const { result } = renderHook(() => useBreadcrumbContext(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.nameMappings).toEqual({});
      expect(typeof result.current.setNameMapping).toBe("function");
    });
  });

  describe("BreadcrumbProvider", () => {
    it("initializes with empty nameMappings", () => {
      const { result } = renderHook(() => useBreadcrumbContext(), { wrapper });

      expect(result.current.nameMappings).toEqual({});
    });

    it("adds a single name mapping", () => {
      const { result } = renderHook(() => useBreadcrumbContext(), { wrapper });

      act(() => {
        result.current.setNameMapping("uuid-1", "Test Name");
      });

      expect(result.current.nameMappings).toEqual({
        "uuid-1": "Test Name",
      });
    });

    it("adds multiple name mappings", () => {
      const { result } = renderHook(() => useBreadcrumbContext(), { wrapper });

      act(() => {
        result.current.setNameMapping("uuid-1", "First Name");
        result.current.setNameMapping("uuid-2", "Second Name");
        result.current.setNameMapping("uuid-3", "Third Name");
      });

      expect(result.current.nameMappings).toEqual({
        "uuid-1": "First Name",
        "uuid-2": "Second Name",
        "uuid-3": "Third Name",
      });
    });

    it("updates existing name mapping", () => {
      const { result } = renderHook(() => useBreadcrumbContext(), { wrapper });

      act(() => {
        result.current.setNameMapping("uuid-1", "Original Name");
      });

      expect(result.current.nameMappings["uuid-1"]).toBe("Original Name");

      act(() => {
        result.current.setNameMapping("uuid-1", "Updated Name");
      });

      expect(result.current.nameMappings["uuid-1"]).toBe("Updated Name");
    });

    it("preserves existing mappings when adding new ones", () => {
      const { result } = renderHook(() => useBreadcrumbContext(), { wrapper });

      act(() => {
        result.current.setNameMapping("uuid-1", "First Name");
      });

      act(() => {
        result.current.setNameMapping("uuid-2", "Second Name");
      });

      expect(result.current.nameMappings).toEqual({
        "uuid-1": "First Name",
        "uuid-2": "Second Name",
      });
    });

    it("handles special characters in names", () => {
      const { result } = renderHook(() => useBreadcrumbContext(), { wrapper });

      act(() => {
        result.current.setNameMapping("uuid-1", "Name with special chars: !@#$%^&*()");
      });

      expect(result.current.nameMappings["uuid-1"]).toBe("Name with special chars: !@#$%^&*()");
    });

    it("handles empty string names", () => {
      const { result } = renderHook(() => useBreadcrumbContext(), { wrapper });

      act(() => {
        result.current.setNameMapping("uuid-1", "");
      });

      expect(result.current.nameMappings["uuid-1"]).toBe("");
    });

    it("handles very long names", () => {
      const { result } = renderHook(() => useBreadcrumbContext(), { wrapper });
      const longName = "A".repeat(1000);

      act(() => {
        result.current.setNameMapping("uuid-1", longName);
      });

      expect(result.current.nameMappings["uuid-1"]).toBe(longName);
    });

    it("maintains separate state for different provider instances", () => {
      const wrapper1 = ({ children }: { children: ReactNode }) => (
        <BreadcrumbProvider>{children}</BreadcrumbProvider>
      );
      const wrapper2 = ({ children }: { children: ReactNode }) => (
        <BreadcrumbProvider>{children}</BreadcrumbProvider>
      );

      const { result: result1 } = renderHook(() => useBreadcrumbContext(), { wrapper: wrapper1 });
      const { result: result2 } = renderHook(() => useBreadcrumbContext(), { wrapper: wrapper2 });

      act(() => {
        result1.current.setNameMapping("uuid-1", "Name in Provider 1");
      });

      act(() => {
        result2.current.setNameMapping("uuid-2", "Name in Provider 2");
      });

      expect(result1.current.nameMappings).toEqual({ "uuid-1": "Name in Provider 1" });
      expect(result2.current.nameMappings).toEqual({ "uuid-2": "Name in Provider 2" });
    });
  });
});
