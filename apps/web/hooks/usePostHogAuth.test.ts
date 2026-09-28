import { renderHook } from "@/test/test-utils";
import posthog from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSession } from "@repo/auth/client";

import { usePostHogAuth } from "./usePostHogAuth";

vi.mock("@repo/auth/client", () => ({ useSession: vi.fn() }));

type SessionResult = ReturnType<typeof useSession>;

function sessionOf(data: SessionResult["data"], isPending = false): SessionResult {
  return { data, isPending, isRefetching: false, error: null, refetch: vi.fn() };
}

describe("usePostHogAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("identifies a signed-in user by id and keeps the email as a property", () => {
    vi.mocked(useSession).mockReturnValue(
      sessionOf({
        user: {
          id: "user-1",
          email: "ada@example.com",
          name: "Ada Lovelace",
          emailVerified: true,
          registered: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "session-1",
          userId: "user-1",
          token: "token",
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    );

    renderHook(() => usePostHogAuth());

    expect(posthog.identify).toHaveBeenCalledWith("user-1", { email: "ada@example.com" });
    expect(posthog.reset).not.toHaveBeenCalled();
  });

  it("leaves PostHog alone while the session is loading", () => {
    vi.mocked(useSession).mockReturnValue(sessionOf(null, true));

    renderHook(() => usePostHogAuth());

    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.reset).not.toHaveBeenCalled();
  });

  it("resets once the session is known to be signed out", () => {
    vi.mocked(useSession).mockReturnValue(sessionOf(null));

    renderHook(() => usePostHogAuth());

    expect(posthog.reset).toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
  });
});
