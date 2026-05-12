"use client";

import * as React from "react";

type WhatsNewContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  unreadCount: number;
  markAllRead: () => void;
};

const WhatsNewContext = React.createContext<WhatsNewContextValue | null>(null);

export function WhatsNewProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(2);

  const markAllRead = React.useCallback(() => setUnreadCount(0), []);

  const handleOpen = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) markAllRead();
    },
    [markAllRead],
  );

  const value = React.useMemo<WhatsNewContextValue>(
    () => ({ open, setOpen: handleOpen, unreadCount, markAllRead }),
    [open, handleOpen, unreadCount, markAllRead],
  );

  return <WhatsNewContext.Provider value={value}>{children}</WhatsNewContext.Provider>;
}

export function useWhatsNew() {
  const ctx = React.useContext(WhatsNewContext);
  if (!ctx) throw new Error("useWhatsNew must be used within WhatsNewProvider");
  return ctx;
}
