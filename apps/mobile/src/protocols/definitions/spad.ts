type ProtocolData = {
  _protocol_set_: {
    label: string;
    spad: number[][];
    protocol_repeats: number;
  }[];
}[];

export const protocol: ProtocolData = [
  {
    _protocol_set_: [
      {
        label: "spad",
        spad: [[2, 3, 6], [-1]],
        protocol_repeats: 1,
      },
    ],
  },
];

export function analyze(data: { set: { spad: number[][] }[] }): Record<string, number[]> {
  const output: Record<string, number[]> = {};
  output.spad = data.set[0].spad[0];
  return output;
}

export const label = "Relative Chlorophyll Content (SPAD)";
