import type { MeasurementData, ProcessedCalibrationOutput } from "./calibration-protocol";

// The five screens of the calibration wizard, in order.
export type CalibrationStep = "setup" | "gain" | "measurements" | "processing" | "complete";

export interface CalibrationState {
  currentStep: CalibrationStep;
  isProcessing: boolean;
  measurements: MeasurementData[];
  currentMeasurementIndex: number;
  currentUserInput: string;
  processedOutput: ProcessedCalibrationOutput | null;
}

export const initialCalibrationState: CalibrationState = {
  currentStep: "setup",
  isProcessing: false,
  measurements: [],
  currentMeasurementIndex: 0,
  currentUserInput: "",
  processedOutput: null,
};

// NB: deliberately leaves currentUserInput and isProcessing untouched
// (mirrors the legacy handler; reset clears them, start does not).
export function startCalibrationState(): Partial<CalibrationState> {
  return {
    currentStep: "gain",
    measurements: [],
    currentMeasurementIndex: 0,
    processedOutput: null,
  };
}

export function processingStartedState(): Partial<CalibrationState> {
  return { isProcessing: true };
}

export function gainCompletedState(): Partial<CalibrationState> {
  return { isProcessing: false, currentStep: "measurements" };
}

// Records the panel measurement, then advances to the next panel — or, after
// the last one, parks on the processing screen (the hook kicks off processing).
export function measurementRecordedState(
  state: CalibrationState,
  measurement: MeasurementData,
  totalMeasurements: number,
): Partial<CalibrationState> {
  const recorded = {
    isProcessing: false,
    measurements: [...state.measurements, measurement],
    currentUserInput: "",
  };
  if (state.currentMeasurementIndex < totalMeasurements - 1) {
    return { ...recorded, currentMeasurementIndex: state.currentMeasurementIndex + 1 };
  }
  return { ...recorded, currentStep: "processing" };
}

export function processingSucceededState(
  output: ProcessedCalibrationOutput,
): Partial<CalibrationState> {
  return { isProcessing: false, currentStep: "complete", processedOutput: output };
}

// Deliberately leaves currentStep alone: the user stays parked on the
// processing screen after the error toast (legacy behavior, no retry UI).
export function processingFailedState(): Partial<CalibrationState> {
  return { isProcessing: false };
}

export function userInputChangedState(value: string): Partial<CalibrationState> {
  return { currentUserInput: value };
}

export function resetCalibrationState(): Partial<CalibrationState> {
  return { ...initialCalibrationState };
}

// The panel number is only encoded in the protocol prompt text ("panel #7 …").
export function panelNumberFromPrompt(prompt: string | undefined): string | undefined {
  return prompt?.match(/#(\d+)/)?.[1];
}

export function measurementProgress(state: CalibrationState, totalMeasurements: number): number {
  return ((state.currentMeasurementIndex + 1) / totalMeasurements) * 100;
}
