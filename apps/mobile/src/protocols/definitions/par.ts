type ProtocolData = {
  averages: number;
  environmental: [string, number][];
}[];

export const protocol: ProtocolData = [
  {
    averages: 1,
    environmental: [["light_intensity", 0]],
  },
];

interface SensorData {
  light_intensity: number;
  r: number;
  g: number;
  b: number;
}

export function analyze(json: SensorData): Record<string, number> {
  return {
    PAR: json.light_intensity,
    red: json.r,
    green: json.g,
    blue: json.b,
  };
}

export const label = "Photosynthetically Active Radiation (PAR)";

export const example = {
  device_name: "MultispeQ-Dummy",
  device_version: "2",
  device_id: "11:16:70:12",
  device_battery: 92,
  device_firmware: 2.345,
  sample: [
    { protocol_id: "", light_intensity: 0.012, r: 0.8, g: 0.4, b: 0.8, w: 0.8, data_raw: [] },
  ],
};
