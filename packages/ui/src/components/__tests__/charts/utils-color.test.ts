import { describe, expect, it } from "vitest";

import { chartGridColor, labToHex, oklchToHex } from "../../charts/utils";

/**
 * jsdom applies no stylesheet, so `readThemeColor` finds nothing and every call
 * site falls through to its `?? "#literal"` — a test written against that literal
 * passes even when the token plumbing is broken. Setting the property makes the
 * real chain run: getComputedStyle -> oklchToHex -> the value Plotly is handed.
 */
const BORDER_TOKEN = "oklch(0.885 0.01 106)";
const BORDER_HEX = "#dadad2";

/**
 * A theme token registered by Tailwind as a `<color>` computes to `lab()`, not
 * to the `oklch()` it was authored as. Plotly cannot parse `lab()` and silently
 * substitutes its own default, so these conversions are what stand between the
 * theme and a white plot panel in dark mode.
 */
describe("labToHex", () => {
  // CSS Color 4 reference values for the sRGB primaries, D50-referred.
  it.each([
    ["white", "lab(100% 0 0)", "#ffffff"],
    ["black", "lab(0% 0 0)", "#000000"],
    ["red", "lab(54.291% 80.805 69.891)", "#ff0000"],
    ["green", "lab(87.818% -79.271 80.991)", "#00ff00"],
    ["blue", "lab(29.568% 68.299 -112.03)", "#0000ff"],
  ])("converts %s", (_name, input, expected) => {
    expect(labToHex(input)).toBe(expected);
  });

  it("accepts a unitless lightness, which is how Chrome serialises it", () => {
    expect(labToHex("lab(100 0 0)")).toBe("#ffffff");
  });

  it("accepts the signed a/b that a real token carries", () => {
    // --card in dark mode, as read off the document root.
    expect(labToHex("lab(9.17423% -7.14382 -2.18825)")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("accepts an alpha component", () => {
    expect(labToHex("lab(100% 0 0 / 0.5)")).toBe("#ffffff");
  });

  it("returns undefined for anything that is not lab()", () => {
    expect(labToHex("oklch(0.5 0.1 200)")).toBeUndefined();
    expect(labToHex("#005e5e")).toBeUndefined();
    expect(labToHex("not a colour")).toBeUndefined();
  });

  it("clamps out-of-gamut channels instead of emitting NaN", () => {
    // A wildly out-of-gamut a* drives a channel negative; the hex must stay valid.
    expect(labToHex("lab(50% -200 -200)")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("oklchToHex", () => {
  it("still converts oklch", () => {
    expect(oklchToHex("oklch(1 0 0)")).toBe("#ffffff");
    expect(oklchToHex("oklch(0 0 0)")).toBe("#000000");
  });

  it("returns undefined for lab(), leaving it to labToHex", () => {
    expect(oklchToHex("lab(100% 0 0)")).toBeUndefined();
  });
});

/**
 * The two halves of `chartGridColor` — the resolved token and the SSR/jsdom
 * fallback. Pinned explicitly because the chart suites mock this module, so
 * nothing else exercises the real chain.
 */
describe("chartGridColor", () => {
  it("resolves --border when the document carries a theme", () => {
    const root = document.documentElement;
    root.style.setProperty("--border", BORDER_TOKEN);
    try {
      expect(chartGridColor()).toBe(BORDER_HEX);
    } finally {
      root.style.removeProperty("--border");
    }
  });

  it("falls back to a literal when no theme is readable", () => {
    // The server-render and jsdom path: getComputedStyle finds nothing.
    expect(chartGridColor()).toBe("#E6E6E6");
  });
});
