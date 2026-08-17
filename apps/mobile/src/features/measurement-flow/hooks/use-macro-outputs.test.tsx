import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMacroOutputs } from "./use-macro-outputs";

const { applyMacro } = vi.hoisted(() => ({ applyMacro: vi.fn() }));
vi.mock("~/features/measurement-flow/utils/process-scan/process-scan", () => ({ applyMacro }));

function renderMacroOutputs(props: Parameters<typeof useMacroOutputs>[0]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return renderHook(() => useMacroOutputs(props), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

const macro = { code: "encoded", language: "javascript" };

beforeEach(() => {
  applyMacro.mockReset();
});

describe("useMacroOutputs", () => {
  it("runs the macro once and forwards exactly one set of outputs", async () => {
    const rawMeasurement = { sample: [{ phi2: 0.8 }, { phi2: 0.2 }] };
    const output = { chlorophyll: 42, trace: [1, 2, 3] };
    const onProcessed = vi.fn();
    applyMacro.mockResolvedValue([output]);

    const { result } = renderMacroOutputs({ rawMeasurement, macro, onProcessed });

    await waitFor(() => expect(onProcessed).toHaveBeenCalledWith([output]));
    expect(onProcessed).toHaveBeenCalledTimes(1);
    expect(applyMacro).toHaveBeenCalledTimes(1);
    expect(applyMacro).toHaveBeenCalledWith(rawMeasurement, macro, {});
    expect(result.current.outputs).toEqual([output]);
  });

  it("passes ctx through to the macro", async () => {
    applyMacro.mockResolvedValue([{ ok: 1 }]);
    const ctx = { upstream: { phi2: 0.5 } };

    renderMacroOutputs({ rawMeasurement: { phi2: 0.8 }, macro, ctx });

    await waitFor(() => expect(applyMacro).toHaveBeenCalledWith({ phi2: 0.8 }, macro, ctx));
  });

  it("surfaces a macro failure and never reports outputs", async () => {
    const onProcessed = vi.fn();
    applyMacro.mockRejectedValue(new Error("Macro input rejected: empty-envelope"));

    const { result } = renderMacroOutputs({ rawMeasurement: { sample: [] }, macro, onProcessed });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error?.message).toBe("Macro input rejected: empty-envelope");
    expect(onProcessed).not.toHaveBeenCalled();
  });

  it("reports an upstream normalization failure without invoking the macro", async () => {
    const inputError = new Error("Output data normalization failed: empty-envelope");
    inputError.name = "OutputDataNormalizationError";
    const onProcessed = vi.fn();

    const { result } = renderMacroOutputs({
      rawMeasurement: { phi2: 0.8 },
      macro,
      inputError,
      onProcessed,
    });

    await waitFor(() => expect(result.current.error).toBe(inputError));
    expect(applyMacro).not.toHaveBeenCalled();
    expect(onProcessed).not.toHaveBeenCalled();
  });

  it("does not run until enabled, so an unopened sheet costs nothing", async () => {
    applyMacro.mockResolvedValue([{ ok: 1 }]);

    const { result } = renderMacroOutputs({ rawMeasurement: { phi2: 0.8 }, macro, enabled: false });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(applyMacro).not.toHaveBeenCalled();
    expect(result.current.outputs).toBeUndefined();
  });

  it("waits for the macro to be resolved before running", async () => {
    applyMacro.mockResolvedValue([{ ok: 1 }]);

    renderMacroOutputs({ rawMeasurement: { phi2: 0.8 }, macro: undefined });

    await waitFor(() => expect(applyMacro).not.toHaveBeenCalled());
  });

  it("serves a rebuilt payload from cache when the caller passes a stable cacheKey", async () => {
    applyMacro.mockResolvedValue([{ ok: 1 }]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    const { rerender } = renderHook(
      (props: Parameters<typeof useMacroOutputs>[0]) => useMacroOutputs(props),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
        initialProps: {
          rawMeasurement: { sample: [{ phi2: 0.8 }] },
          macro,
          cacheKey: "m1/version-1/macro-1",
        },
      },
    );
    await waitFor(() => expect(applyMacro).toHaveBeenCalledTimes(1));

    // A fresh decode produces an equal payload under a new object identity;
    // the stable key must keep that from re-running the macro.
    rerender({
      rawMeasurement: { sample: [{ phi2: 0.8 }] },
      macro: { ...macro },
      cacheKey: "m1/version-1/macro-1",
    });

    await waitFor(() => expect(applyMacro).toHaveBeenCalledTimes(1));
  });
});
