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

export function analyze(data: SensorData): Record<string, number> {
  return {
    PAR: data.light_intensity,
    red: data.r,
    green: data.g,
    blue: data.b,
  };
}

export const label = "Photosynthetically Active Radiation (PAR)";
