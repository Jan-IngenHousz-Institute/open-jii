// Hardcoded calibration protocol JSON
export const CALIBRATION_PROTOCOL = [
  {
    _protocol_set_: [
      {
        label: "spad_card_cal",
        print_spad_cal: 1,
      },
      {
        label: "gain",
        alert:
          "Clamp panel #9 of the Chlorophyll calibration cards and enter the corresponding SPAD value or leave it empty if a Calibration Card envelope serial number was entered before.",
        auto_blank: [
          [2, 2, 3, 100, 10000],
          [6, 6, 1, 100, 10000],
          [3, 3, 3, 100, 10000],
        ],
      },
      {
        label: "spad",
        prompt:
          "Clamp panel #2 of the Chlorophyll calibration cards and enter the corresponding SPAD value or leave it empty if a Calibration Card envelope serial number was entered before.",
        spad: [[2, 3, 6], [-1]],
        protocol_repeats: 1,
      },
      {
        label: "spad",
        prompt:
          "Clamp panel #3 of the Chlorophyll calibration cards and enter the corresponding SPAD value or leave it empty if a Calibration Card envelope serial number was entered before.",
        spad: [[2, 3, 6], [-1]],
        protocol_repeats: 1,
      },
      {
        label: "spad",
        prompt:
          "Clamp panel #4 of the Chlorophyll calibration cards and enter the corresponding SPAD value or leave it empty if a Calibration Card envelope serial number was entered before.",
        spad: [[2, 3, 6], [-1]],
        protocol_repeats: 1,
      },
      {
        label: "spad",
        prompt:
          "Clamp panel #6 of the Chlorophyll calibration cards and enter the corresponding SPAD value or leave it empty if a Calibration Card envelope serial number was entered before.",
        spad: [[2, 3, 6], [-1]],
        protocol_repeats: 1,
      },
      {
        label: "spad",
        prompt:
          "Clamp panel #7 of the Chlorophyll calibration cards and enter the corresponding SPAD value or leave it empty if a Calibration Card envelope serial number was entered before.",
        spad: [[2, 3, 6], [-1]],
        protocol_repeats: 1,
      },
      {
        label: "spad",
        prompt:
          "Clamp panel #8 of the Chlorophyll calibration cards and enter the corresponding SPAD value or leave it empty if a Calibration Card envelope serial number was entered before.",
        spad: [[2, 3, 6], [-1]],
        protocol_repeats: 1,
      },
      {
        label: "spad",
        prompt:
          "Clamp panel #10 of the Chlorophyll calibration cards and enter the corresponding SPAD value or leave it empty if a Calibration Card envelope serial number was entered before.",
        spad: [[2, 3, 6], [-1]],
        protocol_repeats: 1,
      },
      {
        label: "spad",
        prompt:
          "Clamp panel #11 of the Chlorophyll calibration cards and enter the corresponding SPAD value or leave it empty if a Calibration Card envelope serial number was entered before.",
        spad: [[2, 3, 6], [-1]],
        protocol_repeats: 1,
      },
      {
        label: "spad",
        prompt:
          "Clamp panel #12 of the Chlorophyll calibration cards and enter the corresponding SPAD value or leave it empty if a Calibration Card envelope serial number was entered before.",
        spad: [[2, 3, 6], [-1]],
        protocol_repeats: 1,
      },
    ],
  },
];

export type CalibrationStep = "setup" | "gain" | "measurements" | "processing" | "complete";

export interface MeasurementData {
  panelNumber: number;
  spadValue: string;
  measurementData?: any;
}

export interface ProcessedCalibrationOutput {
  calibrationValues: string;
  bestOffset: number;
  maxR2: number;
  spadSlope: number;
  spadYInt: number;
  toDevice: string;
}

// Extract SPAD measurement steps from protocol
export const getSpadSteps = () => {
  return CALIBRATION_PROTOCOL[0]._protocol_set_.filter((step) => step.label === "spad");
};

// Extract gain calibration step from protocol
export const getGainStep = () => {
  return CALIBRATION_PROTOCOL[0]._protocol_set_.find((step) => step.label === "gain");
};

// Generate auto-blank commands for device
export const generateAutoBlankCommands = (autoBlankParams: number[][]) => {
  return autoBlankParams.map((params) => `auto_blank:${params.join(",")}`);
};

// Generate measurement command for device
export const generateMeasurementCommand = (spadParams: number[][]) => {
  return `spad_measurement:${spadParams[0]?.join(",")}`;
};

// Simulate JavaScript macro processing
export const simulateDataProcessing = async (
  measurements: MeasurementData[],
): Promise<ProcessedCalibrationOutput> => {
  // Simulate processing time
  await new Promise<void>((resolve) => setTimeout(() => resolve(), 3000));

  // Simulate processed output
  return {
    calibrationValues: measurements.map((m) => m.spadValue).join(","),
    bestOffset: -50,
    maxR2: 0.98,
    spadSlope: 0.1234,
    spadYInt: -7.964,
    toDevice: "set_spad_offset+-50+set_spad_scale+0.1234+set_spad_yint+-7.964+setCalTime+5+hello+",
  };
};
