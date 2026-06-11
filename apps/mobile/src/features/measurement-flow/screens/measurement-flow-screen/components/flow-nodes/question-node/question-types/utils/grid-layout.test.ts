import { beforeEach, describe, expect, it, vi } from "vitest";

import { calculateGridLayout, GRID_CHAR_THRESHOLD } from "./grid-layout";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("react-native", () => ({
  Dimensions: { get: mockGet },
}));

const SCREEN_WIDTH = 360;
const AVAILABLE_WIDTH = SCREEN_WIDTH - 32; // matches the 32px padding offset

describe("calculateGridLayout", () => {
  beforeEach(() => {
    mockGet.mockReturnValue({ width: SCREEN_WIDTH, height: 800 });
  });

  it("uses a tall 2-column grid for two short options", () => {
    const layout = calculateGridLayout(["Yes", "No"]);
    expect(layout).toMatchObject({ layout: "grid", columns: 2, buttonHeight: 60 });
    expect(layout.buttonWidth).toBeCloseTo((AVAILABLE_WIDTH - 8) / 2);
  });

  it("uses a 2-column grid for three or four short options", () => {
    expect(calculateGridLayout(["A", "B", "C"])).toMatchObject({
      layout: "grid",
      columns: 2,
      buttonHeight: 50,
    });
  });

  it("uses a 3-column grid for five or six short options", () => {
    expect(calculateGridLayout(["A", "B", "C", "D", "E"])).toMatchObject({
      layout: "grid",
      columns: 3,
      buttonHeight: 45,
    });
  });

  it("shrinks the grid buttons for seven or more short options", () => {
    expect(calculateGridLayout(["1", "2", "3", "4", "5", "6", "7", "8"])).toMatchObject({
      layout: "grid",
      columns: 3,
      buttonHeight: 40,
    });
  });

  it("keeps the grid when the longest option is exactly at the threshold", () => {
    const option = "x".repeat(GRID_CHAR_THRESHOLD);
    expect(calculateGridLayout([option, "y"]).layout).toBe("grid");
  });

  it("switches to a full-width list when an option exceeds the threshold", () => {
    const longOption = "x".repeat(GRID_CHAR_THRESHOLD + 1);
    const layout = calculateGridLayout([longOption, "Short"]);
    expect(layout).toMatchObject({ layout: "list", columns: 1, buttonHeight: 48 });
    expect(layout.buttonWidth).toBe(AVAILABLE_WIDTH);
  });

  it("uses the list layout for realistic long sentence answers", () => {
    const layout = calculateGridLayout(["I strongly agree with this statement", "I disagree"]);
    expect(layout).toMatchObject({ layout: "list", columns: 1 });
  });
});
