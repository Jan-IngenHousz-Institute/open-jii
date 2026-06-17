import { act, renderHook } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import type { ActivityEntry } from "./activity-context";
import { useActivity } from "./activity-context";

function makeEntry(over: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: "e1",
    kind: "data_export",
    title: "Export of Table (CSV)",
    status: "running",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("useActivity", () => {
  it("upserts new entries newest-first", () => {
    const { result } = renderHook(() => useActivity());
    act(() => result.current.upsert(makeEntry({ id: "a" })));
    act(() => result.current.upsert(makeEntry({ id: "b" })));
    expect(result.current.entries.map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("updates an existing entry in place by id", () => {
    const { result } = renderHook(() => useActivity());
    act(() => result.current.upsert(makeEntry({ id: "a", status: "running" })));
    act(() =>
      result.current.upsert(
        makeEntry({ id: "a", status: "succeeded", updatedAt: "2026-01-02T00:00:00.000Z" }),
      ),
    );
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]?.status).toBe("succeeded");
  });

  it("is a no-op when status, updatedAt and title are unchanged", () => {
    const { result } = renderHook(() => useActivity());
    act(() => result.current.upsert(makeEntry({ id: "a" })));
    const before = result.current.entries;
    act(() => result.current.upsert(makeEntry({ id: "a" })));
    expect(result.current.entries).toBe(before);
  });

  it("counts only running/succeeded/failed entries as unread", () => {
    const { result } = renderHook(() => useActivity());
    const now = new Date().toISOString();
    act(() => {
      result.current.upsert(makeEntry({ id: "a", status: "succeeded", updatedAt: now }));
      result.current.upsert(makeEntry({ id: "b", status: "queued", updatedAt: now }));
      result.current.upsert(makeEntry({ id: "c", status: "failed", updatedAt: now }));
    });
    expect(result.current.unreadCount).toBe(2);
  });

  it("markAllRead clears the unread count", () => {
    const { result } = renderHook(() => useActivity());
    act(() =>
      result.current.upsert(
        makeEntry({ id: "a", status: "succeeded", updatedAt: new Date().toISOString() }),
      ),
    );
    expect(result.current.unreadCount).toBe(1);
    act(() => result.current.markAllRead());
    expect(result.current.unreadCount).toBe(0);
  });

  it("clear empties entries and resets unread", () => {
    const { result } = renderHook(() => useActivity());
    act(() =>
      result.current.upsert(
        makeEntry({ id: "a", status: "succeeded", updatedAt: new Date().toISOString() }),
      ),
    );
    act(() => result.current.clear());
    expect(result.current.entries).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });
});
