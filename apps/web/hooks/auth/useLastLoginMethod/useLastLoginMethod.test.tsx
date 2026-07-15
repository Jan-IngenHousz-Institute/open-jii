import { renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useLastLoginMethod } from "./useLastLoginMethod";

describe("useLastLoginMethod", () => {
  it("returns the last used login method after the effect runs", () => {
    vi.mocked(authClient.getLastUsedLoginMethod).mockReturnValue("github");

    const { result } = renderHook(() => useLastLoginMethod());

    expect(result.current).toBe("github");
  });

  it("returns null when no method was recorded", () => {
    vi.mocked(authClient.getLastUsedLoginMethod).mockReturnValue(null);

    const { result } = renderHook(() => useLastLoginMethod());

    expect(result.current).toBeNull();
  });
});
