// Calibration protocol types plus the demo-mode device command / processing
// simulation (no real device IO yet — see DemoDisclaimer).

export interface ProtocolStep {
  label: string;
  prompt?: string;
  alert?: string;
  auto_blank?: number[][];
  spad?: number[][];
  protocol_repeats?: number;
  [key: string]: any; // Allow for protocol-specific properties
}

export interface CalibrationProtocol {
  _protocol_set_: ProtocolStep[];
}

export interface MeasurementData {
  stepIndex: number;
  userInput: string;
  measurementData?: any;
  timestamp: string;
}

export interface ProcessedCalibrationOutput {
  calibrationValues: string;
  bestOffset: number;
  maxR2: number;
  spadSlope: number;
  spadYInt: number;
  toDevice: string;
}

export const generateDeviceCommand = (step: ProtocolStep): string => {
  switch (step.label) {
    case "gain":
    case "auto_blank":
      if (step.auto_blank && Array.isArray(step.auto_blank)) {
        return step.auto_blank.map((params) => `auto_blank:${params.join(",")}`).join(";");
      }
      return `gain:${JSON.stringify(step)}`;

    case "spad":
    case "measurement":
      if (step.spad && Array.isArray(step.spad)) {
        return `measurement:${step.spad[0]?.join(",")}`;
      }
      return `measurement:${JSON.stringify(step)}`;

    default:
      return `${step.label}:${JSON.stringify(step)}`;
  }
};

// Simulated JavaScript macro processing (demo mode).
export const simulateDataProcessing = async (
  measurements: MeasurementData[],
  _protocol: CalibrationProtocol,
): Promise<ProcessedCalibrationOutput> => {
  await new Promise<void>((resolve) => setTimeout(() => resolve(), 3000));

  const userInputs = measurements
    .filter((m) => m.userInput)
    .map((m) => parseFloat(m.userInput))
    .filter((val) => !isNaN(val));

  return {
    calibrationValues: userInputs.join(","),
    bestOffset: -50,
    maxR2: 0.98,
    spadSlope: 0.1234,
    spadYInt: -7.964,
    toDevice: "set_spad_offset+-50+set_spad_scale+0.1234+set_spad_yint+-7.964+setCalTime+5+hello+",
  };
};
