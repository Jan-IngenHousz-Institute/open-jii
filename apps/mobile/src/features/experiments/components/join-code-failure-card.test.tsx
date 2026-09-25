import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { TouchableOpacity } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FailureCard, ThrottledCard } from "./join-code-failure-card";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      ({
        "common:retry": "Retry",
        "experiments:joinCode.tooMany": "Too many attempts. You can try again now.",
        "experiments:joinCode.tooManyCountdown": `Too many attempts. Try again in ${String(options?.seconds)}s.`,
      })[key] ?? key,
  }),
}));

function retryDisabled() {
  return (screen.UNSAFE_getByType(TouchableOpacity) as { props: { disabled?: boolean } }).props
    .disabled;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ThrottledCard", () => {
  it("holds Retry for the throttle window, then lets it through", () => {
    const onRetry = vi.fn<() => void>();

    render(<ThrottledCard throttledAt={Date.now()} onRetry={onRetry} />);

    expect(screen.getByText("Too many attempts. Try again in 60s.")).toBeTruthy();
    expect(retryDisabled()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(screen.getByText("Too many attempts. Try again in 1s.")).toBeTruthy();
    expect(retryDisabled()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText("Too many attempts. You can try again now.")).toBeTruthy();
    expect(retryDisabled()).toBe(false);

    fireEvent.press(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("counts from when the refusal arrived, not from when the card rendered", () => {
    render(<ThrottledCard throttledAt={Date.now() - 45_000} onRetry={vi.fn()} />);

    expect(screen.getByText("Too many attempts. Try again in 15s.")).toBeTruthy();
  });

  it("offers Retry at once for a refusal older than the window", () => {
    render(<ThrottledCard throttledAt={Date.now() - 90_000} onRetry={vi.fn()} />);

    expect(screen.getByText("Too many attempts. You can try again now.")).toBeTruthy();
    expect(retryDisabled()).toBe(false);
  });
});

describe("FailureCard", () => {
  it("renders the message alone when there is no action", () => {
    render(<FailureCard message="Something went wrong" />);

    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(TouchableOpacity)).toHaveLength(0);
  });

  it("runs the action when it is enabled", () => {
    const onAction = vi.fn<() => void>();

    render(<FailureCard message="Something went wrong" actionLabel="Retry" onAction={onAction} />);

    expect(retryDisabled()).toBe(false);
    fireEvent.press(screen.getByText("Retry"));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
