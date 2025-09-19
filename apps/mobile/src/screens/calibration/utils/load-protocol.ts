// Protocol types and utilities

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

// Generate device commands
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
        return `spad_measurement:${step.spad[0]?.join(",")}`;
      }
      return `measurement:${JSON.stringify(step)}`;

    default:
      return `${step.label}:${JSON.stringify(step)}`;
  }
};

// Simulate data processing (JavaScript macro simulation)
export const simulateDataProcessing = async (
  measurements: MeasurementData[],
  protocol: CalibrationProtocol,
): Promise<ProcessedCalibrationOutput> => {
  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Extract user inputs
  const userInputs = measurements
    .filter((m) => m.userInput)
    .map((m) => parseFloat(m.userInput))
    .filter((val) => !isNaN(val));

  // Simulate calibration calculation
  const calibrationValues = userInputs.join(",");

  // Simulate processed output
  return {
    calibrationValues,
    bestOffset: -50,
    maxR2: 0.98,
    spadSlope: 0.1234,
    spadYInt: -7.964,
    toDevice: "set_spad_offset+-50+set_spad_scale+0.1234+set_spad_yint+-7.964+setCalTime+5+hello+",
  };
};
