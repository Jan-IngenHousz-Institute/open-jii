"use client";

import { reloadPage } from "@/lib/reload-page";
import { settledIdentity, SIGNED_OUT } from "@/lib/session-identity";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { authClient, useSession } from "@repo/auth/client";

const RELOAD_KEY = "openjii.principal-reload";

// A mismatch that survives a reload is not reloaded again, so the page cannot loop.
function reloadOnce(marker: string) {
  try {
    if (window.sessionStorage.getItem(RELOAD_KEY) === marker) return;
    window.sessionStorage.setItem(RELOAD_KEY, marker);
  } catch {
    // Without storage the reload still happens; only the loop guard is lost.
  }
  reloadPage();
}

/**
 * Renders the platform only for the person the server rendered it for. Its pages carry that
 * person's data into the query cache, so once the browser's session settles on someone else the
 * page is reloaded for them instead. A pending session or a failed refetch changes nothing.
 */
export function PrincipalGate({ userId, children }: { userId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useSession();
  const { refetch } = session;
  const identity = settledIdentity(session);
  const [settled, setSettled] = useState<string>();
  if (identity !== undefined && identity !== settled) setSettled(identity);
  const current = identity ?? settled;
  const open = current === undefined || current === userId;

  useEffect(() => {
    if (!open) return;
    if (current !== userId) return;
    try {
      window.sessionStorage.removeItem(RELOAD_KEY);
    } catch {
      // Nothing to reset.
    }
  }, [open, current, userId]);

  useEffect(() => {
    if (open) return;
    void queryClient.cancelQueries();
    queryClient.clear();
    let active = true;
    void authClient.getSession().then(({ data, error }) => {
      if (!active) return;
      const fresh = error ? undefined : (data?.user.id ?? SIGNED_OUT);
      if (fresh === userId) {
        void refetch();
        return;
      }
      reloadOnce(`${userId}>${fresh ?? "unknown"}`);
    });
    return () => {
      active = false;
    };
  }, [open, queryClient, refetch, userId]);

  return open ? children : null;
}
