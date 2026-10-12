"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import { useSession } from "@repo/auth/client";

const ServerPrincipalContext = createContext<string | null>(null);

interface PrincipalProviderProps {
  userId: string;
  children: ReactNode;
}

/** The user the server rendered the page for, so client queries need not wait to learn it. */
export function PrincipalProvider({ userId, children }: PrincipalProviderProps) {
  return (
    <ServerPrincipalContext.Provider value={userId}>{children}</ServerPrincipalContext.Provider>
  );
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
