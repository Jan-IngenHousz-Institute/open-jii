import { afterEach, describe, expect, it } from "vitest";

import { PLATFORM_SERIES_TOKENS, PLOTLY_SERIES_TAIL } from "../../charts/colorway";
import {
  invalidateThemeTokenCache,
  platformChartColor,
  resolveChartColorway,
} from "../../charts/utils";

function setToken(token: string, value: string) {
  document.documentElement.style.setProperty(token, value);
}

afterEach(() => {
  for (const token of PLATFORM_SERIES_TOKENS) {
    document.documentElement.style.removeProperty(token);
  }
  invalidateThemeTokenCache();
});

describe("resolveChartColorway", () => {
  it("puts the platform's own colours first and Plotly's after them", () => {
    invalidateThemeTokenCache();
    const colorway = resolveChartColorway();

    expect(colorway).toHaveLength(PLATFORM_SERIES_TOKENS.length + PLOTLY_SERIES_TAIL.length);
    expect(colorway.slice(PLATFORM_SERIES_TOKENS.length)).toEqual([...PLOTLY_SERIES_TAIL]);
  });

  it("resolves the head from the theme, so it follows a light/dark swap", () => {
    invalidateThemeTokenCache();
    PLATFORM_SERIES_TOKENS.forEach((token, index) => {
      setToken(token, `oklch(0.5 0.1 ${index * 40})`);
    });
    invalidateThemeTokenCache();

    const head = resolveChartColorway().slice(0, PLATFORM_SERIES_TOKENS.length);
    for (const color of head) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // Six different hues in, six different colours out.
    expect(new Set(head).size).toBe(PLATFORM_SERIES_TOKENS.length);
  });

  it("falls back to light-mode literals when no theme is readable", () => {
    invalidateThemeTokenCache();
    // jsdom applies no stylesheet, so every slot falls through to the SSR path,
    // which must still hand Plotly a parseable colour.
    for (const color of resolveChartColorway()) {
      expect(color).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });

  it("starts at the brand teal", () => {
    invalidateThemeTokenCache();
    expect(PLATFORM_SERIES_TOKENS[0]).toBe("--chart-1");
    expect(resolveChartColorway()[0]).toBe("#005E5E");
  });
});

describe("platformChartColor", () => {
  it("wraps rather than running out", () => {
    invalidateThemeTokenCache();
    const colorway = resolveChartColorway();

    expect(platformChartColor(0)).toBe(colorway[0]);
    expect(platformChartColor(colorway.length)).toBe(colorway[0]);
    expect(platformChartColor(colorway.length + 3)).toBe(colorway[3]);
  });

  it("treats a negative or fractional index as a slot rather than crashing", () => {
    invalidateThemeTokenCache();
    expect(platformChartColor(-1)).toBe(resolveChartColorway()[1]);
    expect(platformChartColor(2.7)).toBe(resolveChartColorway()[2]);
  });
});
