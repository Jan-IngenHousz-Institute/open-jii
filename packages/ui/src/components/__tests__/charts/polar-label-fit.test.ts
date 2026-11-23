import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";

import {
  fitCompactRadarTicks,
  fitWindTicks,
  linearTicks,
  radarLabelsCollide,
  usePolarFontRevision,
} from "../../charts/polar-label-fit";
import type { MeasureLabel } from "../../charts/polar-label-fit";

const compass = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
].map((text, index) => ({ angle: index * 22.5, text }));

const measure: MeasureLabel = (text, size) => {
  const advance = size * 0.55;
  return {
    width: text.length * advance,
    boxes: [...text].map((_, index) => ({
      left: index * advance,
      right: (index + 1) * advance,
      top: -size * 0.7,
      bottom: 0,
    })),
  };
};

it.each([
  { diameter: 108, peak: 185, expected: [0, 50, 100] },
  { diameter: 137, peak: 220, expected: [0, 100, 200] },
])("keeps every compass label when only radial numbers overlap", ({ diameter, peak, expected }) => {
  expect(
    fitWindTicks({ diameter, peak, size: 11, labels: compass, measure, compact: false }),
  ).toEqual({ step: 1, ticks: expected });
});

it("leaves Plotly's automatic ticks alone when they already fit", () => {
  expect(
    fitWindTicks({
      diameter: 137,
      peak: 105,
      size: 11,
      labels: compass,
      measure,
      compact: false,
    }),
  ).toEqual({ step: 1, ticks: undefined });
});

it("keeps the radial ticks when only the degree labels overlap", () => {
  const labels = Array.from({ length: 32 }, (_, index) => ({
    angle: index * 11.25,
    text: `${index * 11.25}°`,
  }));
  const fit = fitWindTicks({
    diameter: 75,
    peak: 1,
    size: 10,
    labels,
    measure,
    compact: true,
  });
  expect(fit.step).toBeGreaterThan(1);
  expect(fit.ticks).toEqual(linearTicks(0, 1 / 0.95, 5));
});

it("predicts Plotly's linear ticks around decade and half-decade intervals", () => {
  expect(linearTicks(0, 231.58, 5)).toEqual([0, 50, 100, 150, 200]);
  expect(linearTicks(0, 105, 5)).toEqual([0, 50, 100]);
  expect(linearTicks(0, 101, 2)).toEqual([0, 100]);
});

it("detects when adjacent radar headings share space", () => {
  const args = {
    size: 11,
    labels: [
      { text: "primary_assay_measurement", angle: 0 },
      { text: "secondary_assay_measurement", angle: 22.5 },
    ],
    range: [0, 2080] as const,
    ticks: [],
    measure,
  };
  expect(radarLabelsCollide({ ...args, diameter: 60 })).toBe(true);
  expect(radarLabelsCollide({ ...args, diameter: 510 })).toBe(false);
});

it("moves the compact radial spoke when it shares space with a heading", () => {
  const input = {
    diameter: 61,
    headingSize: 9,
    tickSize: 10,
    range: [0, 2150] as const,
    ticks: [0, 2000],
    measure,
  };
  expect(fitCompactRadarTicks({ ...input, labels: [] })).toEqual({
    angle: -90,
    ticks: [0, 2000],
  });
  const fit = fitCompactRadarTicks({
    ...input,
    labels: [{ angle: 225, text: "relative_humidity" }],
  });
  expect(fit).toEqual({ angle: 90, ticks: [0, 2000] });
});

it("updates the font revision only for a successful load in the chart's font stack", () => {
  const fonts = new EventTarget();
  const previousFonts = Object.getOwnPropertyDescriptor(document, "fonts");
  const style = document.body.style;
  const previousFamily = style.getPropertyValue("--font-sans");
  Object.defineProperty(document, "fonts", { configurable: true, value: fonts });
  style.setProperty("--font-sans", '"Audit Chart", Audit Fallback, sans-serif');

  const { result, unmount } = renderHook(usePolarFontRevision);
  const initial = result.current;
  function finish(...fontfaces: Pick<FontFace, "family" | "status">[]) {
    act(() => {
      fonts.dispatchEvent(Object.assign(new Event("loadingdone"), { fontfaces }));
    });
  }
  try {
    finish();
    finish({ family: "Audit Chart Editor", status: "loaded" });
    finish({ family: "Audit Chart", status: "error" });
    expect(result.current).toBe(initial);

    finish(
      { family: "'AUDIT CHART'", status: "loaded" },
      { family: "Audit Fallback", status: "loaded" },
    );
    expect(result.current).toBe(initial + 1);
  } finally {
    unmount();
    style.setProperty("--font-sans", previousFamily);
    if (previousFonts) Object.defineProperty(document, "fonts", previousFonts);
    else Reflect.deleteProperty(document, "fonts");
  }
});
