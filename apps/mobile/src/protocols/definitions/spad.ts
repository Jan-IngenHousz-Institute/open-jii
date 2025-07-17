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

export const example = {
  device_name: "MultispeQ-Dummy",
  device_version: "2",
  device_id: "11:16:70:12",
  device_battery: 91,
  device_firmware: 2.345,
  sample: [
    {
      protocol_id: "",
      set: [
        {
          label: "spad",
          absorbance: [
            [65535, 9940, -40, -0.817608, 2, 3, 655],
            [65535, 8388, 0, -0.892815, 6, 1, 950],
          ],
          spad: [9.184, 36.846, -40, 6.413],
          data_raw: [],
        },
      ],
    },
  ],
};
