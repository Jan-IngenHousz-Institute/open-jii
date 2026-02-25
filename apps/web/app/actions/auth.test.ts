import { headers } from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { authClient } from "@repo/auth/client";

import { auth } from "./auth";

// This file tests the real auth() function — unmock the global stub.
vi.unmock("~/app/actions/auth");

vi.mock("@repo/auth/client", () => ({
  authClient: { getSession: vi.fn() },
}));

const mockGetSession = vi.mocked(authClient.getSession);

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("returns session data on success", async () => {
    const session = { session: { id: "s1" }, user: { id: "u1" } };
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: "session=abc" }) as never);
    mockGetSession.mockResolvedValue({ data: session } as never);

    expect(await auth()).toEqual(session);
  });

  it("returns null and logs error on failure", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers() as never);
    mockGetSession.mockRejectedValue(new Error("Network error"));

    expect(await auth()).toBeNull();
    expect(console.error).toHaveBeenCalledWith("Session fetch error:", expect.any(Error));
  });

  it("returns null when session is null", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers() as never);
    mockGetSession.mockResolvedValue({ data: null } as never);

    expect(await auth()).toBeNull();
  });
});
