import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";
import { afterEach, expect, it, vi } from "vitest";

import { _resetSessionCacheForTests, getCachedSession } from "./session-cache";
import { subscribeSession } from "./session-clock";

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("expo-secure-store", () => ({
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  storage.clear();
});

it("reassesses an expired guest immediately on foreground and shares the clock between readers", () => {
  vi.useFakeTimers();
  const created = new Date("2026-10-01T12:00:00Z");
  vi.setSystemTime(created);
  _resetSessionCacheForTests();
  storage.set(
    "openjii_session_data",
    JSON.stringify({
      user: { id: "guest", isAnonymous: true, createdAt: created.toISOString() },
      session: { expiresAt: "2027-01-01" },
    }),
  );
  let foreground: (state: AppStateStatus) => void = () => undefined;
  const remove = vi.fn();
  const subscribe = vi.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    foreground = handler;
    return { remove };
  });
  const seen: (string | null)[] = [];
  const first = subscribeSession(() => {
    seen.push(getCachedSession()?.user.id ?? null);
  });
  const listener = vi.fn();
  const second = subscribeSession(listener);
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(seen).toEqual(["guest"]);
  foreground("background");
  expect(seen).toEqual(["guest"]);
  vi.setSystemTime(created.getTime() + 7 * 86400000);
  foreground("active");
  expect(seen[seen.length - 1]).toBeNull();
  expect(listener).toHaveBeenCalledTimes(1);
  first();
  expect(remove).not.toHaveBeenCalled();
  second();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
