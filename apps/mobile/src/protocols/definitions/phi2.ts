type ProtocolData = {
  pulses: number[];
  pulse_distance: number[];
  pulse_length: number[][];
  pulsed_lights: number[][];
  pulsed_lights_brightness: number[][];
  nonpulsed_lights: (number[] | string[])[];
  nonpulsed_lights_brightness: (number[] | string[])[];
  detectors: number[][];
  environmental: string[][];
  open_close_start: number;
}[];

export const protocol: ProtocolData = [
  {
    pulses: [20, 50, 20],
    pulse_distance: [10000, 10000, 10000],
    pulse_length: [[30], [30], [30]],
    pulsed_lights: [[3], [3], [3]],
    pulsed_lights_brightness: [[2000], [30], [30]],
    nonpulsed_lights: [[2], [2], [2]],
    nonpulsed_lights_brightness: [["light_intensity"], [4500], ["light_intensity"]],
    detectors: [[1], [1], [1]],
    environmental: [["light_intensity"]],
    open_close_start: 1,
  },
];

interface RawData {
  data_raw: number[];
  light_intensity: number;
}

function mean(arr: number[]): number {
  const sum = arr.reduce((acc, val) => acc + val, 0);
  return sum / arr.length;
}

export function analyze(data: RawData): Record<string, number> {
  const fs = mean(data.data_raw.slice(1, 5)); // indexes 1 to 4
  const fmp = mean(data.data_raw.slice(63, 68)); // indexes 63 to 67
  const phi2 = (fmp - fs) / fmp;
  const lef = phi2 * data.light_intensity * 0.45;

  return {
    Fs: fs,
    Fmp: fmp,
    Phi2: phi2,
    LEF: lef,
    PAR: data.light_intensity,
  };
}

export const label = "Photosystem II efficiency (Phi2)";
