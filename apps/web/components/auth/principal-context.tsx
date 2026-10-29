"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import { useSession } from "@repo/auth/client";

const ServerPrincipalContext = createContext<string | null>(null);
const ServerGuestContext = createContext(false);

interface PrincipalProviderProps {
  userId: string;
  isGuest?: boolean;
  children: ReactNode;
}

/** The user the server rendered the page for, so client queries need not wait to learn it. */
export function PrincipalProvider({ userId, isGuest = false, children }: PrincipalProviderProps) {
  return (
    <ServerPrincipalContext.Provider value={userId}>
      <ServerGuestContext.Provider value={isGuest}>{children}</ServerGuestContext.Provider>
    </ServerPrincipalContext.Provider>
  );
}

/** Whether the page was rendered for a guest. Known from the first render, unlike the session. */
export function useIsGuest() {
  return useContext(ServerGuestContext);
}

interface Principal {
  userId: string | undefined;
  isPending: boolean;
}

/**
 * Who principal-scoped queries are for. The browser's session wins once it has
 * loaded; until then the server's answer stands in, and outside the platform
 * there is nothing to stand in, so queries wait for the session as before.
 */
export function usePrincipal(): Principal {
  const serverUserId = useContext(ServerPrincipalContext);
  const { data: session, isPending } = useSession();

  if (!isPending) {
    return { userId: session?.user.id, isPending: false };
  }
  if (serverUserId !== null) {
    return { userId: serverUserId, isPending: false };
  }
  return { userId: undefined, isPending: true };
}
