import { headers } from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { authClient } from "@repo/auth/client";
import type { Session } from "@repo/auth/types";

import { auth } from "./auth";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

// Mock authClient
vi.mock("@repo/auth/client", () => ({
  authClient: {
    getSession: vi.fn(),
  },
}));

const mockHeaders = vi.mocked(headers);
const mockGetSession = vi.mocked(authClient.getSession);

describe("auth", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("should return session data when authentication is successful", async () => {
    const mockHeadersList = new Headers({ cookie: "session=abc123" });
    const mockSession: Session = {
      session: {
        id: "session-123",
        userId: "user-123",
        expiresAt: new Date("2026-12-31"),
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
        token: "token-123",
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      },
      user: {
        id: "user-123",
        email: "test@example.com",
        emailVerified: true,
        name: "Test User",
        image: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
        registered: true,
      },
    };

    mockHeaders.mockResolvedValue(mockHeadersList);
    mockGetSession.mockResolvedValue({ data: mockSession });

    const result = await auth();

    expect(mockHeaders).toHaveBeenCalled();
    expect(mockGetSession).toHaveBeenCalledWith({
      fetchOptions: {
        headers: mockHeadersList,
      },
    });
    expect(result).toEqual(mockSession);
  });

  it("should return null and log error when session fetch fails", async () => {
    const mockHeadersList = new Headers();
    const mockError = new Error("Network error");

    mockHeaders.mockResolvedValue(mockHeadersList);
    mockGetSession.mockRejectedValue(mockError);

    const result = await auth();

    expect(mockHeaders).toHaveBeenCalled();
    expect(mockGetSession).toHaveBeenCalledWith({
      fetchOptions: {
        headers: mockHeadersList,
      },
    });
    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith("Session fetch error:", mockError);
  });

  it("should return null when session data is null", async () => {
    const mockHeadersList = new Headers();

    mockHeaders.mockResolvedValue(mockHeadersList);
    mockGetSession.mockResolvedValue({ data: null });

    const result = await auth();

    expect(result).toBeNull();
  });

  it("should forward headers correctly to authClient", async () => {
    const mockHeadersList = new Headers({
      cookie: "session=abc123",
      "user-agent": "Mozilla/5.0",
    });

    mockHeaders.mockResolvedValue(mockHeadersList);
    mockGetSession.mockResolvedValue({ data: null });

    await auth();

    expect(mockGetSession).toHaveBeenCalledWith({
      fetchOptions: {
        headers: mockHeadersList,
      },
    });
  });

  it("should handle headers() promise rejection", async () => {
    const mockError = new Error("Headers unavailable");

    mockHeaders.mockRejectedValue(mockError);

    const result = await auth();

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith("Session fetch error:", mockError);
  });
});
