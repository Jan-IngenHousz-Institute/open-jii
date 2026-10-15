import { act, render, screen } from "@testing-library/react-native";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScanningState } from "./scanning-state";

vi.mock("~/shared/ui/hooks/use-theme", () => ({
  useTheme: () => ({
    classes: { text: "", textMuted: "" },
    colors: { brand: "#000" },
  }),
}));

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ScanningState", () => {
  it("ticks the elapsed clock once a second from the scan start", () => {
    render(<ScanningState scanStartedAt={Date.now() - 5_000} />);

    expect(screen.getByText("5s")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByText("7s")).toBeTruthy();
  });

  it("reads the elapsed time at once when a scan starts after mount", () => {
    const { rerender } = render(<ScanningState />);
    expect(screen.getByText("0s")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    rerender(<ScanningState scanStartedAt={Date.now() - 3_000} />);

    expect(screen.getByText("3s")).toBeTruthy();
  });

  it("restarts the clock for a new scan", () => {
    const { rerender } = render(<ScanningState scanStartedAt={Date.now() - 20_000} />);
    expect(screen.getByText("20s")).toBeTruthy();

    rerender(<ScanningState scanStartedAt={Date.now()} />);
    expect(screen.getByText("0s")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText("1s")).toBeTruthy();
  });
});
