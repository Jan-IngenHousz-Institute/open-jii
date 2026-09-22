import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useExperimentOnboardingState } from "./use-experiment-onboarding-state";

interface ExperimentsState {
  rows: { membershipStatus: string }[] | undefined;
  isLoading: boolean;
  isPaused: boolean;
  error: Error | null;
}

const state = vi.hoisted<ExperimentsState>(() => ({
  rows: undefined,
  isLoading: false,
  isPaused: false,
  error: null,
}));

vi.mock("~/features/experiments/hooks/use-experiments", () => ({
  useExperiments: () => ({
    experiments: [],
    rows: state.rows,
    isLoading: state.isLoading,
    isPaused: state.isPaused,
    error: state.error,
  }),
}));

beforeEach(() => {
  state.rows = undefined;
  state.isLoading = false;
  state.isPaused = false;
  state.error = null;
});

describe("useExperimentOnboardingState", () => {
  it("is undefined until the related list has answered", () => {
    const { result } = renderHook(() => useExperimentOnboardingState());

    expect(result.current.state).toBeUndefined();
  });

  it("stays undefined on a cold offline load, where rows never arrive", () => {
    state.isPaused = true;

    const { result } = renderHook(() => useExperimentOnboardingState());

    expect(result.current.state).toBeUndefined();
    expect(result.current.isPaused).toBe(true);
  });

  it("is none for a loaded empty list", () => {
    state.rows = [];

    const { result } = renderHook(() => useExperimentOnboardingState());

    expect(result.current.state).toEqual({ kind: "none" });
  });

  it("is none for authorship-only rows, which the related slice still returns", () => {
    state.rows = [{ membershipStatus: "none" }, { membershipStatus: "none" }];

    const { result } = renderHook(() => useExperimentOnboardingState());

    expect(result.current.state).toEqual({ kind: "none" });
  });

  it("is member as soon as one row says member", () => {
    state.rows = [{ membershipStatus: "none" }, { membershipStatus: "member" }];

    const { result } = renderHook(() => useExperimentOnboardingState());

    expect(result.current.state).toEqual({ kind: "member" });
  });

  it("passes the loading and error signals straight through", () => {
    state.isLoading = true;
    state.error = new Error("boom");

    const { result } = renderHook(() => useExperimentOnboardingState());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error?.message).toBe("boom");
  });
});
