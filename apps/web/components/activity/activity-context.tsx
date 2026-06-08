"use client";

import * as React from "react";

export type ActivityJobKind = "data_export" | "ambyte_processing" | "metadata_reprocess";
export type ActivityJobStatus = "queued" | "pending" | "running" | "succeeded" | "failed";

export interface ActivityEntry {
  id: string;
  kind: ActivityJobKind;
  title: string;
  status: ActivityJobStatus;
  createdAt: string;
  updatedAt: string;
  resultUrl?: string;
  format?: string;
  experimentId?: string;
}

interface ActivityContextValue {
  entries: ActivityEntry[];
  unreadCount: number;
  upsert: (entry: ActivityEntry) => void;
  markAllRead: () => void;
  clear: () => void;
}

const ActivityContext = React.createContext<ActivityContextValue | null>(null);

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<ActivityEntry[]>([]);
  const [lastSeenAt, setLastSeenAt] = React.useState<number>(0);

  const upsert = React.useCallback((entry: ActivityEntry) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx === -1) return [entry, ...prev];
      const existing = prev[idx];
      // Avoid unnecessary state updates when nothing meaningfully changed.
      if (
        existing.status === entry.status &&
        existing.updatedAt === entry.updatedAt &&
        existing.title === entry.title
      ) {
        return prev;
      }
      const next = [...prev];
      next[idx] = { ...existing, ...entry };
      return next;
    });
  }, []);

  const markAllRead = React.useCallback(() => setLastSeenAt(Date.now()), []);

  const clear = React.useCallback(() => {
    setEntries([]);
    setLastSeenAt(Date.now());
  }, []);

  const unreadCount = React.useMemo(
    () =>
      entries.filter(
        (e) =>
          new Date(e.updatedAt).getTime() > lastSeenAt &&
          (e.status === "running" || e.status === "failed" || e.status === "succeeded"),
      ).length,
    [entries, lastSeenAt],
  );

  const value = React.useMemo<ActivityContextValue>(
    () => ({ entries, unreadCount, upsert, markAllRead, clear }),
    [entries, unreadCount, upsert, markAllRead, clear],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity() {
  const ctx = React.useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used within ActivityProvider");
  return ctx;
}
