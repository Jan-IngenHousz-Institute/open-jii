import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  _resetSessionCacheForTests,
  acceptNewSession,
  assessLocalSession,
  clearLocalCredentials,
  getCachedSession,
  recordGuestClock,
  sessionGeneration,
  validLocalSession,
} from "./session-cache";

const { storage, setItem } = vi.hoisted(() => {
  const storage = new Map<string, string>();
  return {
    storage,
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
  };
});
vi.mock("expo-secure-store", () => ({
  getItem: (key: string) => storage.get(key) ?? null,
  setItem,
}));
const now = new Date("2026-10-21T12:00:00Z");
function guest(id = "guest-a") {
  return {
    user: { id, name: "Guest", isAnonymous: true, createdAt: now.toISOString() },
    session: { expiresAt: "2027-01-01" },
  };
}
beforeEach(() => {
  storage.clear();
  _resetSessionCacheForTests();
  setItem.mockClear();
  vi.setSystemTime(now);
  acceptNewSession("guest-a");
});

describe("guest credential lifecycle", () => {
  it("expires by original creation date rather than refreshed session expiry", () => {
    storage.set("openjii_session_data", JSON.stringify(guest()));
    vi.setSystemTime(now.getTime() + 7 * 86400000 - 1);
    expect(getCachedSession()?.user.id).toBe("guest-a");
    vi.setSystemTime(now.getTime() + 7 * 86400000);
    expect(getCachedSession()).toBeNull();
  });
  it("retains the clock high-water mark across repeated session validations", () => {
    storage.set("openjii_session_data", JSON.stringify(guest()));
    vi.setSystemTime(now.getTime() + 86400000);
    expect(getCachedSession()).not.toBeNull();
    setItem.mockClear();
    recordGuestClock("guest-a");
    recordGuestClock("guest-a");
    expect(setItem).toHaveBeenCalledOnce();
    vi.setSystemTime(now.getTime() + 86400000 - 120001);
    expect(validLocalSession(guest())).toBeNull();
    expect(getCachedSession()).toBeNull();
  });
  it("clears chunked credentials and refuses a departed guest even if its response arrives later", () => {
    const payload = JSON.stringify(guest());
    storage.set("openjii_session_data", "\u0001ba-chunks:2");
    storage.set("openjii_session_data.0", payload.slice(0, 40));
    storage.set("openjii_session_data.1", payload.slice(40));
    storage.set("openjii_cookie", "\u0001ba-chunks:1");
    storage.set("openjii_cookie.0", "secret-cookie");
    expect(getCachedSession()?.user.id).toBe("guest-a");
    const previous = sessionGeneration();
    clearLocalCredentials("guest-a");
    expect(sessionGeneration()).toBeGreaterThan(previous);
    expect(storage.get("openjii_session_data.0")).toBe("");
    expect(storage.get("openjii_cookie.0")).toBe("");
    storage.set("openjii_session_data", payload);
    expect(getCachedSession()).toBeNull();
    expect(validLocalSession(guest("guest-b"))?.user.id).toBe("guest-b");
  });
  it("revokes in memory and attempts every cleanup after a partial storage failure", () => {
    setItem.mockImplementationOnce(() => {
      throw new Error("storage failure");
    });
    expect(() => clearLocalCredentials("guest-a")).toThrow("storage failure");
    expect(storage.get("openjii_cookie")).toBe("{}");
    expect(storage.get("openjii_session_data")).toBe("{}");
    expect(validLocalSession(guest())).toBeNull();
    expect(() => clearLocalCredentials("guest-a")).not.toThrow();
  });
  it("validates without writing to secure storage", () => {
    storage.set("openjii_session_data", JSON.stringify(guest()));
    setItem.mockClear();
    getCachedSession();
    validLocalSession(guest());
    expect(setItem).not.toHaveBeenCalled();
  });
  it("tells a departed guest apart from an expired one", () => {
    expect(assessLocalSession(guest("guest-c"), now.getTime() + 7 * 86400000)).toEqual({
      session: null,
      expired: true,
    });
    clearLocalCredentials("guest-d");
    expect(assessLocalSession(guest("guest-d"))).toEqual({ session: null, expired: false });
  });
  it("preserves researcher offline access without a guest creation date", () => {
    expect(validLocalSession({ user: { id: "researcher" }, session: {} })?.user.id).toBe(
      "researcher",
    );
  });
});
