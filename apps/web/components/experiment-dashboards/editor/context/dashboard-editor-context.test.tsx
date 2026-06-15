import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { DashboardEditorProvider, useDashboardEditor } from "./dashboard-editor-context";

const wrapper = ({ children }: { children: ReactNode }) => (
  <DashboardEditorProvider>{children}</DashboardEditorProvider>
);

describe("DashboardEditorContext", () => {
  it("throws when consumed outside the provider", () => {
    const orig = console.error;
    console.error = () => {
      /* silence the boundary warning */
    };
    try {
      expect(() => renderHook(() => useDashboardEditor())).toThrow(
        /must be used inside DashboardEditorProvider/,
      );
    } finally {
      console.error = orig;
    }
  });

  it("starts with no widget selected and the cursor tool", () => {
    const { result } = renderHook(() => useDashboardEditor(), { wrapper });
    expect(result.current.selectedWidgetId).toBeNull();
    expect(result.current.tool).toBe("cursor");
  });

  it("selectWidget round-trips a string id and clears with null", () => {
    const { result } = renderHook(() => useDashboardEditor(), { wrapper });
    act(() => result.current.selectWidget("widget-1"));
    expect(result.current.selectedWidgetId).toBe("widget-1");
    act(() => result.current.selectWidget(null));
    expect(result.current.selectedWidgetId).toBeNull();
  });

  it("setTool flips the active placement tool", () => {
    const { result } = renderHook(() => useDashboardEditor(), { wrapper });
    act(() => result.current.setTool("chart"));
    expect(result.current.tool).toBe("chart");
    act(() => result.current.setTool("filter"));
    expect(result.current.tool).toBe("filter");
  });

  it("keeps the same selectWidget reference across renders (stable callback)", () => {
    const { result, rerender } = renderHook(() => useDashboardEditor(), { wrapper });
    const first = result.current.selectWidget;
    rerender();
    expect(result.current.selectWidget).toBe(first);
  });

  it("starts with the dataset popover closed and toggles via setDatasetOpen", () => {
    const { result } = renderHook(() => useDashboardEditor(), { wrapper });
    expect(result.current.datasetOpen).toBe(false);
    act(() => result.current.setDatasetOpen(true));
    expect(result.current.datasetOpen).toBe(true);
    act(() => result.current.setDatasetOpen(false));
    expect(result.current.datasetOpen).toBe(false);
  });
});
