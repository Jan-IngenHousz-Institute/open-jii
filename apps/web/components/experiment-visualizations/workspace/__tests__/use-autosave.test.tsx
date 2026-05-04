import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChartFormValues } from "../../charts/form-values";
import { lineChartType } from "../../charts/line";
import { VisualizationSaveProvider, useVisualizationSaveStatus } from "../save-context";
import { useAutosave } from "../use-autosave";

// Manually-resolved mutate so we can interleave save fires and check the
// race-guard / in-flight semantics. Tests reach into `mutateDeferred`'s
// queue to settle promises in an explicit order.
const mutateAsyncMock = vi.fn();

vi.mock(
  "@/hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate",
  () => ({
    useExperimentVisualizationUpdate: () => ({ mutateAsync: mutateAsyncMock }),
  }),
);

const wrapper = ({ children }: { children: ReactNode }) => (
  <VisualizationSaveProvider>{children}</VisualizationSaveProvider>
);

interface Harness {
  form: UseFormReturn<ChartFormValues>;
  status: ReturnType<typeof useVisualizationSaveStatus>;
}

function makeDefaults(): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: lineChartType.defaultDataConfig(),
  };
}

function setup(delayMs = 1500) {
  return renderHook(
    () => {
      const form = useForm<ChartFormValues>({ defaultValues: makeDefaults() });
      useAutosave({ form, experimentId: "exp-1", visualizationId: "viz-1", delayMs });
      const status = useVisualizationSaveStatus();
      return { form, status } satisfies Harness;
    },
    { wrapper },
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  mutateAsyncMock.mockReset();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("useAutosave", () => {
  it("does not fire a save before the user touches the form", () => {
    setup();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("debounces edits and fires a single save after the delay elapses", async () => {
    mutateAsyncMock.mockResolvedValue({ status: 200, body: {} });
    const { result } = setup(1500);

    act(() => {
      result.current.form.setValue("name", "Edit 1", { shouldDirty: true });
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => {
      result.current.form.setValue("name", "Edit 2", { shouldDirty: true });
    });
    expect(mutateAsyncMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(mutateAsyncMock.mock.calls[0][0].body.name).toBe("Edit 2");
  });

  it("transitions through markChanged → markSaving → markSaved on the happy path", async () => {
    mutateAsyncMock.mockResolvedValue({ status: 200, body: {} });
    const { result } = setup(1000);

    act(() => {
      result.current.form.setValue("name", "Edit", { shouldDirty: true });
    });
    expect(result.current.status.isDirty).toBe(true);
    expect(result.current.status.isSaving).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.status.isSaving).toBe(false);
    expect(result.current.status.isDirty).toBe(false);
    expect(result.current.status.hasError).toBe(false);
  });

  it("keeps isDirty when an edit lands while a save is in flight", async () => {
    let resolveSave!: (value: { status: number; body: unknown }) => void;
    mutateAsyncMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const { result } = setup(500);

    act(() => {
      result.current.form.setValue("name", "Edit 1", { shouldDirty: true });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(result.current.status.isSaving).toBe(true);

    // Type more while the first save is still pending.
    act(() => {
      result.current.form.setValue("name", "Edit 2", { shouldDirty: true });
    });

    await act(async () => {
      resolveSave({ status: 200, body: {} });
      await Promise.resolve();
    });

    // markSavingDone path: the save resolved but we have unsaved edits, so
    // isSaving clears but isDirty stays true.
    expect(result.current.status.isSaving).toBe(false);
    expect(result.current.status.isDirty).toBe(true);
  });

  it("flips to hasError on a failed save", async () => {
    mutateAsyncMock.mockRejectedValue(new Error("boom"));
    const { result } = setup(500);

    act(() => {
      result.current.form.setValue("name", "Edit", { shouldDirty: true });
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(result.current.status.isSaving).toBe(false);
    expect(result.current.status.hasError).toBe(true);
  });

  it("ignores a slow stale save resolution after a fresh save has already applied", async () => {
    let resolveSlow!: (value: { status: number; body: unknown }) => void;
    let resolveFresh!: (value: { status: number; body: unknown }) => void;
    mutateAsyncMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSlow = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFresh = resolve;
        }),
      );

    const { result } = setup(300);

    act(() => {
      result.current.form.setValue("name", "Edit 1", { shouldDirty: true });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // First save in flight.

    act(() => {
      result.current.form.setValue("name", "Edit 2", { shouldDirty: true });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // Second save in flight (the in-flight edit guard re-fires the debounce).

    expect(mutateAsyncMock).toHaveBeenCalledTimes(2);

    // Resolve the FRESH save first.
    await act(async () => {
      resolveFresh({ status: 200, body: {} });
      await Promise.resolve();
    });
    expect(result.current.status.isDirty).toBe(false);
    expect(result.current.status.hasError).toBe(false);

    // Now resolve the SLOW (stale) save. It must not clobber the cleared
    // state — its seq is older than the latest applied.
    await act(async () => {
      resolveSlow({ status: 200, body: {} });
      await Promise.resolve();
    });
    expect(result.current.status.isDirty).toBe(false);
    expect(result.current.status.hasError).toBe(false);
  });

  it("clears the pending debounce on unmount", async () => {
    mutateAsyncMock.mockResolvedValue({ status: 200, body: {} });
    const { result, unmount } = setup(500);

    act(() => {
      result.current.form.setValue("name", "Edit", { shouldDirty: true });
    });

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });
});
