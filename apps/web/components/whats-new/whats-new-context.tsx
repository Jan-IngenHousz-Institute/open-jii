"use client";

import * as React from "react";

import { WHATS_NEW_ENTRIES } from "./whats-new-entries";

interface WhatsNewContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  unreadCount: number;
  markAllRead: () => void;
}

const WhatsNewContext = React.createContext<WhatsNewContextValue | null>(null);

const STORAGE_KEY = "openjii:whats-new-last-seen";

function entriesNewerThan(lastSeen: number): number {
  return WHATS_NEW_ENTRIES.filter((e) => new Date(e.publishedAt).getTime() > lastSeen).length;
}

export function WhatsNewProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = React.useState(false);
  // Start at 0 on both server and first client render to avoid a hydration
  // mismatch; the real last-seen value is read from localStorage after mount.
  const [lastSeen, setLastSeen] = React.useState(0);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLastSeen(Number(raw) || 0);
    } catch {
      // localStorage unavailable (SSR/private mode) — leave at 0.
    }
  }, []);

  const markAllRead = React.useCallback(() => {
    const now = Date.now();
    setLastSeen(now);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // ignore persistence failure; unread still clears for this session.
    }
  }, []);

  const setOpen = React.useCallback(
    (next: boolean) => {
      setOpenState(next);
      if (!next) markAllRead();
    },
    [markAllRead],
  );

  const unreadCount = React.useMemo(() => entriesNewerThan(lastSeen), [lastSeen]);

  const value = React.useMemo<WhatsNewContextValue>(
    () => ({ open, setOpen, unreadCount, markAllRead }),
    [open, setOpen, unreadCount, markAllRead],
  );

  return <WhatsNewContext.Provider value={value}>{children}</WhatsNewContext.Provider>;
}

export function useWhatsNew() {
  const ctx = React.useContext(WhatsNewContext);
  if (!ctx) throw new Error("useWhatsNew must be used within WhatsNewProvider");
  return ctx;
}
