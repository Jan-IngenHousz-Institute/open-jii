import { describe, expect, it } from "vitest";

import { COLORSCALES, colorscaleStops, resolveColorscale } from "./colorscales";

describe("COLORSCALES", () => {
  it("emits a non-empty registry", () => {
    expect(COLORSCALES.length).toBeGreaterThan(0);
  });

  it("derives a `linear-gradient(to right, ...)` from each entry's colors", () => {
    for (const entry of COLORSCALES) {
      expect(entry.gradient).toBe(`linear-gradient(to right, ${entry.colors.join(", ")})`);
    }
  });

  it("exposes every entry with a unique `value`", () => {
    const values = COLORSCALES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("ships explicit plotlyStops for non-built-in scales (Magma, OrRd, OpenJII)", () => {
    const magma = COLORSCALES.find((c) => c.value === "Magma");
    const orrd = COLORSCALES.find((c) => c.value === "OrRd");
    const openjii = COLORSCALES.find((c) => c.value === "OpenJII");
    expect(magma?.plotlyStops?.length).toBeGreaterThan(0);
    expect(orrd?.plotlyStops?.length).toBeGreaterThan(0);
    expect(openjii?.plotlyStops?.length).toBeGreaterThan(0);
  });
});

describe("resolveColorscale", () => {
  it("returns explicit stops for entries that ship them (Magma)", () => {
    const result = resolveColorscale("Magma");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(COLORSCALES.find((c) => c.value === "Magma")?.plotlyStops);
  });

  it("returns the plotly built-in name for entries without explicit stops (Viridis)", () => {
    expect(resolveColorscale("Viridis")).toBe("Viridis");
  });

  it("falls back to the input name when not in the registry", () => {
    expect(resolveColorscale("not-a-scale")).toBe("not-a-scale");
  });
});

describe("colorscaleStops", () => {
  it("returns the colors array for a registered scale", () => {
    const viridis = COLORSCALES.find((c) => c.value === "Viridis");
    expect(colorscaleStops("Viridis")).toBe(viridis?.colors);
  });

  it("falls back to the first registered scale's colors for unknown names", () => {
    expect(colorscaleStops("not-a-scale")).toBe(COLORSCALES[0].colors);
  });

  it("returns colors in gradient order (matches the entry)", () => {
    const entry = COLORSCALES.find((c) => c.value === "Greys");
    expect(colorscaleStops("Greys")).toEqual(entry?.colors);
  });
});
