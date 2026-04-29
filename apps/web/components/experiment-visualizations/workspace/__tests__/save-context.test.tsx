import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useVisualizationSaveStatus, VisualizationSaveProvider } from "../save-context";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <VisualizationSaveProvider>{children}</VisualizationSaveProvider>
);

describe("VisualizationSaveContext", () => {
  it("starts as not-dirty, not-saving, no error", () => {
    const { result } = renderHook(() => useVisualizationSaveStatus(), { wrapper });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it("markDirty flips isDirty true and clears error", () => {
    const { result } = renderHook(() => useVisualizationSaveStatus(), { wrapper });
    act(() => result.current.markFailed());
    expect(result.current.hasError).toBe(true);
    act(() => result.current.markDirty());
    expect(result.current.isDirty).toBe(true);
    expect(result.current.hasError).toBe(false);
  });

  it("markSaving sets isSaving true and clears error", () => {
    const { result } = renderHook(() => useVisualizationSaveStatus(), { wrapper });
    act(() => result.current.markSaving());
    expect(result.current.isSaving).toBe(true);
    expect(result.current.hasError).toBe(false);
  });

  it("markSaved clears isSaving + isDirty + error", () => {
    const { result } = renderHook(() => useVisualizationSaveStatus(), { wrapper });
    act(() => {
      result.current.markDirty();
      result.current.markSaving();
    });
    expect(result.current.isSaving).toBe(true);
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.markSaved());
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it("markFailed clears isSaving and sets hasError", () => {
    const { result } = renderHook(() => useVisualizationSaveStatus(), { wrapper });
    act(() => result.current.markSaving());
    expect(result.current.isSaving).toBe(true);

    act(() => result.current.markFailed());
    expect(result.current.isSaving).toBe(false);
    expect(result.current.hasError).toBe(true);
  });
});
