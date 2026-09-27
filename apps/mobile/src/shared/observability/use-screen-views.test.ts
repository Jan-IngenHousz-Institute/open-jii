import { renderHook } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { screenNameOf, useScreenViews } from "./use-screen-views";

const { segments } = vi.hoisted(() => {
  const current: { value: string[] } = { value: [] };
  return { segments: current };
});

vi.mock("expo-router", () => ({ useSegments: () => segments.value }));

const posthog = { screen: vi.fn() };

beforeEach(() => {
  posthog.screen.mockClear();
});

describe("screenNameOf", () => {
  it("keeps the route pattern and drops layout groups", () => {
    expect(screenNameOf(["(tabs)", "measure"])).toBe("/measure");
    expect(screenNameOf(["organizations", "[id]"])).toBe("/organizations/[id]");
    expect(screenNameOf([])).toBe("/");
  });
});

describe("useScreenViews", () => {
  it("records a view when the route pattern changes, not on every render", () => {
    segments.value = ["(tabs)", "measure"];
    const { rerender } = renderHook(() => useScreenViews(posthog));
    rerender({});

    segments.value = ["organizations", "[id]"];
    rerender({});

    expect(posthog.screen.mock.calls).toEqual([["/measure"], ["/organizations/[id]"]]);
  });
});
