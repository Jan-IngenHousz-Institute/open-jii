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

export const example = {
  device_name: "MultispeQ-Dummy",
  device_version: "2",
  device_id: "11:16:70:12",
  device_battery: 92,
  device_firmware: 2.345,
  sample: [
    {
      protocol_id: "",
      light_intensity: 0,
      r: 0,
      g: 0,
      b: 0,
      w: 0,
      data_raw: [
        173, 169, 166, 172, 166, 172, 168, 166, 172, 170, 168, 170, 168, 174, 171, 170, 168, 168,
        165, 164, 114, 115, 109, 116, 113, 111, 112, 113, 110, 112, 111, 108, 111, 111, 109, 112,
        108, 114, 107, 112, 111, 112, 106, 110, 114, 108, 110, 108, 112, 106, 112, 112, 111, 109,
        112, 108, 111, 114, 106, 110, 111, 106, 112, 106, 108, 110, 111, 107, 113, 108, 91, 96, 93,
        95, 95, 90, 95, 96, 87, 91, 92, 96, 91, 91, 98, 98, 93, 94, 95, 94,
      ],
    },
  ],
};
