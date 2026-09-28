import { renderHook } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePostHogIdentity } from "./use-posthog-identity";

const posthog = { identify: vi.fn(), reset: vi.fn() };

beforeEach(() => {
  posthog.identify.mockClear();
  posthog.reset.mockClear();
});

describe("usePostHogIdentity", () => {
  it("identifies the signed-in user by id once, however often it renders", () => {
    const { rerender } = renderHook<void, { userId: string | undefined }>(
      ({ userId }) => usePostHogIdentity(posthog, userId),
      {
        initialProps: { userId: "user-1" },
      },
    );
    rerender({ userId: "user-1" });

    expect(posthog.identify).toHaveBeenCalledTimes(1);
    expect(posthog.identify).toHaveBeenCalledWith("user-1");
  });

  it("resets on sign-out, but not on a start with nobody signed in", () => {
    const signedOut: { userId: string | undefined } = { userId: undefined };
    const { rerender } = renderHook<void, { userId: string | undefined }>(
      ({ userId }) => usePostHogIdentity(posthog, userId),
      {
        initialProps: signedOut,
      },
    );
    expect(posthog.reset).not.toHaveBeenCalled();

    rerender({ userId: "user-1" });
    rerender({ userId: undefined });

    expect(posthog.reset).toHaveBeenCalledTimes(1);
  });

  it("waits for the client", () => {
    renderHook(() => usePostHogIdentity(undefined, "user-1"));

    expect(posthog.identify).not.toHaveBeenCalled();
  });
});
