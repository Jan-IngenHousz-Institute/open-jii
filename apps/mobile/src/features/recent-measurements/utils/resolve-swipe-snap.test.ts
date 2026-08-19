import { describe, expect, it } from "vitest";

import { resolveSwipeSnap } from "./resolve-swipe-snap";

const ACTION_WIDTH = 104;

describe("resolveSwipeSnap", () => {
  it("closes on a rightward flick, however far the row is open", () => {
    expect(resolveSwipeSnap({ translateX: -100, velocityX: 900, actionWidth: ACTION_WIDTH })).toBe(
      0,
    );
  });

  it("opens on a leftward flick, however little the row moved", () => {
    expect(resolveSwipeSnap({ translateX: -4, velocityX: -900, actionWidth: ACTION_WIDTH })).toBe(
      -ACTION_WIDTH,
    );
  });

  it("opens a slow drag past halfway", () => {
    expect(resolveSwipeSnap({ translateX: -60, velocityX: 0, actionWidth: ACTION_WIDTH })).toBe(
      -ACTION_WIDTH,
    );
  });

  it("closes a slow drag that stayed under halfway", () => {
    expect(resolveSwipeSnap({ translateX: -40, velocityX: 0, actionWidth: ACTION_WIDTH })).toBe(0);
  });

  it("treats a below-threshold velocity as a slow drag", () => {
    expect(resolveSwipeSnap({ translateX: -80, velocityX: 100, actionWidth: ACTION_WIDTH })).toBe(
      -ACTION_WIDTH,
    );
    expect(resolveSwipeSnap({ translateX: -10, velocityX: -100, actionWidth: ACTION_WIDTH })).toBe(
      0,
    );
  });

  it("stays closed when there are no actions to reveal", () => {
    expect(resolveSwipeSnap({ translateX: -20, velocityX: 0, actionWidth: 0 })).toBe(0);
  });
});
