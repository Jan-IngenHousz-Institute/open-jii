import { expect, it } from "vitest";

import { chooseWindTicks } from "../../charts/polar-label-fit";

const compass = Array.from({ length: 16 }, (_, index) => ({
  axis: "angular" as const,
  value: index * 22.5,
  text: String(index * 22.5),
}));
const radial = [0, 50, 100, 150, 200].map((value) => ({
  axis: "radial" as const,
  value,
  text: String(value),
}));

it.each([
  { range: radial.slice(0, 4), expected: [0, 50, 100] },
  { range: radial, expected: [0, 100, 200] },
])(
  "retains the compass and the densest evenly spaced radial ticks ($expected)",
  ({ range, expected }) => {
    const fit = chooseWindTicks(compass, range, (kept) => {
      const values = [...kept].filter((tick) => tick.axis === "radial").map((tick) => tick.value);
      return !(values.includes(150) && (values.includes(100) || values.includes(200)));
    });
    expect(fit?.angular).toEqual(compass);
    expect(fit?.radial.map((tick) => tick.value)).toEqual(expected);
  },
);

it("retains every radial tick when only adjacent compass labels overlap", () => {
  const fit = chooseWindTicks(compass, radial, (kept) => {
    const values = [...kept].filter((tick) => tick.axis === "angular").map((tick) => tick.value);
    return !(values.includes(0) && values.includes(22.5));
  });
  expect(fit?.angular).toEqual(compass.filter((_, index) => index % 2 === 0));
  expect(fit?.radial).toEqual(radial);
});
