// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalibrationProtocol } from "~/features/calibration/domain/calibration-protocol";
import { useCalibrationFlow } from "~/features/calibration/hooks/use-calibration-flow";

const { mockToastSuccess, mockToastError, mockSimulate } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockSimulate: vi.fn(),
}));

vi.mock("sonner-native", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("~/features/calibration/domain/calibration-protocol", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/features/calibration/domain/calibration-protocol")>()),
  simulateDataProcessing: mockSimulate,
}));

const output = {
  calibrationValues: "12,34",
  bestOffset: -50,
  maxR2: 0.98,
  spadSlope: 0.1234,
  spadYInt: -7.964,
  toDevice: "set_spad_offset+-50",
};

const protocol: CalibrationProtocol = {
  _protocol_set_: [
    { label: "spad_card_cal", print_spad_cal: 1 },
    { label: "gain", alert: "Clamp panel #9", auto_blank: [[2, 2, 3, 100, 10000]] },
    { label: "spad", prompt: "Clamp panel #2", spad: [[2, 3, 6], [-1]] },
    { label: "spad", prompt: "Clamp panel #3", spad: [[2, 3, 6], [-1]] },
  ],
};

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

// Drives one simulated measurement (input -> take -> 1500ms device delay).
async function measure(
  result: { current: ReturnType<typeof useCalibrationFlow> },
  input: string,
  panel: number,
) {
  act(() => {
    result.current.setUserInput(input);
  });
  act(() => {
    void result.current.takeMeasurement(panel);
  });
  expect(result.current.isProcessing).toBe(true);
  await advance(1500);
}

beforeEach(() => {
  vi.useFakeTimers();
  mockSimulate.mockResolvedValue(output);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useCalibrationFlow", () => {
  it("starts on setup with derived fields from the protocol", () => {
    const { result } = renderHook(() => useCalibrationFlow(protocol));

    expect(result.current.currentStep).toBe("setup");
    expect(result.current.totalMeasurements).toBe(2);
    expect(result.current.gainAlertMessage).toBe("Clamp panel #9");
    expect(result.current.currentPanelNumber).toBe("2");
    expect(result.current.progressPercentage).toBe(50);
  });

  it("startCalibration moves to gain", () => {
    const { result } = renderHook(() => useCalibrationFlow(protocol));

    act(() => {
      result.current.startCalibration();
    });

    expect(result.current.currentStep).toBe("gain");
  });

  it("gain calibration spins for 2s then advances to measurements", async () => {
    const { result } = renderHook(() => useCalibrationFlow(protocol));
    act(() => {
      result.current.startCalibration();
    });

    act(() => {
      void result.current.startGainCalibration();
    });
    expect(result.current.isProcessing).toBe(true);
    expect(result.current.currentStep).toBe("gain");

    await advance(2000);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.currentStep).toBe("measurements");
  });

  it("runs the full measurement loop, processes ALL measurements and toasts success", async () => {
    const { result } = renderHook(() => useCalibrationFlow(protocol));
    act(() => {
      result.current.startCalibration();
    });
    act(() => {
      void result.current.startGainCalibration();
    });
    await advance(2000);

    await measure(result, "12", 2);
    expect(result.current.currentStep).toBe("measurements");
    expect(result.current.currentMeasurementIndex).toBe(1);
    expect(result.current.currentPanelNumber).toBe("3");
    expect(result.current.currentUserInput).toBe("");
    expect(result.current.progressPercentage).toBe(100);

    await measure(result, "34", 3);
    expect(result.current.currentStep).toBe("processing");
    expect(result.current.isProcessing).toBe(true);
    // the last measurement is included (the legacy stale-closure drop is fixed)
    expect(mockSimulate).toHaveBeenCalledWith(
      [expect.objectContaining({ userInput: "12" }), expect.objectContaining({ userInput: "34" })],
      protocol,
    );

    await advance(1000);
    expect(result.current.currentStep).toBe("complete");
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.processedOutput).toEqual(output);
    expect(result.current.measurements).toHaveLength(2);
    expect(mockToastSuccess).toHaveBeenCalledWith("calibration:flow.toastComplete");
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("stays parked on processing and toasts the error when processing fails", async () => {
    mockSimulate.mockRejectedValue(new Error("macro exploded"));
    const { result } = renderHook(() => useCalibrationFlow(protocol));
    act(() => {
      result.current.startCalibration();
    });
    act(() => {
      void result.current.startGainCalibration();
    });
    await advance(2000);

    await measure(result, "12", 2);
    await measure(result, "34", 3);
    await advance(0);

    expect(result.current.currentStep).toBe("processing");
    expect(result.current.isProcessing).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith("calibration:flow.toastProcessingError");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("reset returns to the initial state", async () => {
    const { result } = renderHook(() => useCalibrationFlow(protocol));
    act(() => {
      result.current.startCalibration();
    });
    act(() => {
      void result.current.startGainCalibration();
    });
    await advance(2000);
    await measure(result, "12", 2);

    act(() => {
      result.current.reset();
    });

    expect(result.current.currentStep).toBe("setup");
    expect(result.current.measurements).toEqual([]);
    expect(result.current.currentMeasurementIndex).toBe(0);
    expect(result.current.currentUserInput).toBe("");
    expect(result.current.processedOutput).toBeNull();
  });

  it("gain calibration is a no-op without a gain step", async () => {
    const { result } = renderHook(() =>
      useCalibrationFlow({ _protocol_set_: [{ label: "spad", prompt: "panel #2" }] }),
    );

    await act(async () => {
      await result.current.startGainCalibration();
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.currentStep).toBe("setup");
  });

  it("takeMeasurement is a no-op without measurement step data", async () => {
    const { result } = renderHook(() => useCalibrationFlow({ _protocol_set_: [] }));

    await act(async () => {
      await result.current.takeMeasurement(2);
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.measurements).toEqual([]);
  });
});
