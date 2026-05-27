import { describe, expectTypeOf, it } from "vitest";

import type {
  BarChartOptions,
  ColorEncodingOptions,
  ErrorBarChartOptions,
  FacetOptions,
  ReferenceLine,
  ReferenceLinesOptions,
  SecondaryAxisOptions,
} from "./chart-options";

describe("ColorEncodingOptions", () => {
  it("accepts categorical or continuous colorMode", () => {
    expectTypeOf<ColorEncodingOptions["colorMode"]>().toEqualTypeOf<
      "continuous" | "categorical" | undefined
    >();
  });

  it("treats colorMap as Record<string, string>", () => {
    const opts: ColorEncodingOptions = { colorMap: { a: "#000" } };
    expectTypeOf(opts.colorMap).toEqualTypeOf<Record<string, string> | undefined>();
  });
});

describe("BarChartOptions", () => {
  it("constrains orientation to 'v' | 'h'", () => {
    expectTypeOf<BarChartOptions["orientation"]>().toEqualTypeOf<"v" | "h" | undefined>();
  });

  it("constrains barmode to the four plotly modes", () => {
    expectTypeOf<BarChartOptions["barmode"]>().toEqualTypeOf<
      "group" | "stack" | "overlay" | "relative" | undefined
    >();
  });

  it("allows numeric gap fields", () => {
    const opts: BarChartOptions = { bargap: 0.1, bargroupgap: 0.05 };
    expectTypeOf(opts.bargap).toEqualTypeOf<number | undefined>();
    expectTypeOf(opts.bargroupgap).toEqualTypeOf<number | undefined>();
  });
});

describe("FacetOptions", () => {
  it("constrains facetRowOrder to top-to-bottom or bottom-to-top", () => {
    expectTypeOf<FacetOptions["facetRowOrder"]>().toEqualTypeOf<
      "top-to-bottom" | "bottom-to-top" | undefined
    >();
  });

  it("accepts a numeric facetColumns and four boolean shared flags", () => {
    const opts: FacetOptions = {
      facetColumns: 3,
      facetSharedX: true,
      facetSharedY: false,
      facetSharedXTitle: true,
      facetSharedYTitle: false,
    };
    expectTypeOf(opts.facetColumns).toEqualTypeOf<number | undefined>();
  });
});

describe("ReferenceLine + ReferenceLinesOptions", () => {
  it("axis is 'x' | 'y' and dash is the four plotly variants", () => {
    expectTypeOf<ReferenceLine["axis"]>().toEqualTypeOf<"x" | "y">();
    expectTypeOf<ReferenceLine["dash"]>().toEqualTypeOf<
      "solid" | "dash" | "dot" | "dashdot" | undefined
    >();
  });

  it("references a list on the options wrapper", () => {
    const opts: ReferenceLinesOptions = { referenceLines: [{ axis: "y", value: 10 }] };
    expectTypeOf(opts.referenceLines).toEqualTypeOf<ReferenceLine[] | undefined>();
  });
});

describe("ErrorBarChartOptions", () => {
  it("carries thickness and cap width as optional numbers", () => {
    expectTypeOf<ErrorBarChartOptions["errorBarThickness"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ErrorBarChartOptions["errorBarCapWidth"]>().toEqualTypeOf<number | undefined>();
  });
});

describe("SecondaryAxisOptions", () => {
  it("constrains y2AxisType to the four plotly axis modes", () => {
    expectTypeOf<SecondaryAxisOptions["y2AxisType"]>().toEqualTypeOf<
      "linear" | "log" | "date" | "category" | undefined
    >();
  });
});
