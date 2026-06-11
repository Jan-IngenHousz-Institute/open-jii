import { describe, expect, it } from "vitest";

import type { MeasurementData } from "./calibration-protocol";
import type { CalibrationState } from "./calibration-transitions";
import {
  gainCompletedState,
  initialCalibrationState,
  measurementProgress,
  measurementRecordedState,
  panelNumberFromPrompt,
  processingFailedState,
  processingStartedState,
  processingSucceededState,
  resetCalibrationState,
  startCalibrationState,
  userInputChangedState,
} from "./calibration-transitions";

const measurement = (stepIndex: number): MeasurementData => ({
  stepIndex,
  userInput: `${stepIndex}`,
  timestamp: "2026-01-01T00:00:00.000Z",
});

const measuring = (overrides: Partial<CalibrationState> = {}): CalibrationState => ({
  ...initialCalibrationState,
  currentStep: "measurements",
  currentUserInput: "42",
  ...overrides,
});

describe("simple transitions", () => {
  it.each([
    ["processingStarted", processingStartedState(), { isProcessing: true }],
    ["gainCompleted", gainCompletedState(), { isProcessing: false, currentStep: "measurements" }],
    ["processingFailed", processingFailedState(), { isProcessing: false }],
    ["userInputChanged", userInputChangedState("12.5"), { currentUserInput: "12.5" }],
    ["reset", resetCalibrationState(), initialCalibrationState],
  ] as const)("%s", (_name, patch, expected) => {
    expect(patch).toEqual(expected);
  });
});

describe("startCalibrationState", () => {
  it("moves to gain and clears any previous run's data", () => {
    expect(startCalibrationState()).toEqual({
      currentStep: "gain",
      measurements: [],
      currentMeasurementIndex: 0,
      processedOutput: null,
    });
  });

  it("leaves currentUserInput and isProcessing untouched (legacy quirk)", () => {
    const patch = startCalibrationState();
    expect("currentUserInput" in patch).toBe(false);
    expect("isProcessing" in patch).toBe(false);
  });
});

describe("measurementRecordedState", () => {
  it("mid-run: appends, clears the input and advances to the next panel", () => {
    const patch = measurementRecordedState(measuring(), measurement(0), 3);
    expect(patch).toEqual({
      isProcessing: false,
      measurements: [measurement(0)],
      currentUserInput: "",
      currentMeasurementIndex: 1,
    });
    expect("currentStep" in patch).toBe(false);
  });

  it("appends to earlier measurements without mutating the previous array", () => {
    const state = measuring({ measurements: [measurement(0)], currentMeasurementIndex: 1 });
    const patch = measurementRecordedState(state, measurement(1), 3);
    expect(patch.measurements).toEqual([measurement(0), measurement(1)]);
    expect(state.measurements).toEqual([measurement(0)]);
  });

  it("last panel: parks on processing and leaves the index where it is", () => {
    const state = measuring({
      measurements: [measurement(0), measurement(1)],
      currentMeasurementIndex: 2,
    });
    const patch = measurementRecordedState(state, measurement(2), 3);
    expect(patch.currentStep).toBe("processing");
    expect(patch.measurements).toHaveLength(3);
    expect("currentMeasurementIndex" in patch).toBe(false);
  });

  it("single-panel protocol goes straight to processing", () => {
    expect(measurementRecordedState(measuring(), measurement(0), 1).currentStep).toBe("processing");
  });

  // Unreachable from the UI (the hook bails when there is no step data),
  // but documents the boundary behavior.
  it("zero-panel protocol also lands on processing", () => {
    expect(measurementRecordedState(measuring(), measurement(0), 0).currentStep).toBe("processing");
  });

  it("an index past the end also lands on processing", () => {
    const state = measuring({ currentMeasurementIndex: 5 });
    expect(measurementRecordedState(state, measurement(5), 3).currentStep).toBe("processing");
  });
});

describe("processingSucceededState", () => {
  it("completes the flow, stores the output and clears the spinner", () => {
    const output = {
      calibrationValues: "1,2",
      bestOffset: -50,
      maxR2: 0.98,
      spadSlope: 0.1234,
      spadYInt: -7.964,
      toDevice: "set_spad_offset+-50",
    };
    expect(processingSucceededState(output)).toEqual({
      isProcessing: false,
      currentStep: "complete",
      processedOutput: output,
    });
  });
});

describe("processingFailedState", () => {
  it("leaves currentStep alone — the user stays parked on the processing screen", () => {
    expect("currentStep" in processingFailedState()).toBe(false);
  });
});

describe("panelNumberFromPrompt", () => {
  it.each([
    ["Clamp panel #2 of the Chlorophyll calibration cards", "2"],
    ["Clamp panel #12 of the Chlorophyll calibration cards", "12"],
    ["panel #3 then also #4", "3"],
    ["no panel marker here", undefined],
    [undefined, undefined],
  ])("%s -> %s", (prompt, expected) => {
    expect(panelNumberFromPrompt(prompt)).toBe(expected);
  });
});

describe("measurementProgress", () => {
  it.each([
    [0, 10, 10],
    [4, 10, 50],
    [9, 10, 100],
    [0, 1, 100],
  ])("index %i of %i -> %i%%", (index, total, expected) => {
    expect(measurementProgress(measuring({ currentMeasurementIndex: index }), total)).toBe(
      expected,
    );
  });

  // Unreachable from the UI; documents the legacy division.
  it("is Infinity for a zero-panel protocol", () => {
    expect(measurementProgress(measuring(), 0)).toBe(Infinity);
  });
});
