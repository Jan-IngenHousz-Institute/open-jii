"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import { useSession } from "@repo/auth/client";

interface SessionPrincipal {
  userId: string;
  sessionId: string;
}

const ServerPrincipalContext = createContext<SessionPrincipal | null>(null);

interface PrincipalProviderProps extends SessionPrincipal {
  children: ReactNode;
}

/** The user the server rendered the page for, so client queries need not wait to learn it. */
export function PrincipalProvider({ userId, sessionId, children }: PrincipalProviderProps) {
  return (
    <ServerPrincipalContext.Provider value={{ userId, sessionId }}>
      {children}
    </ServerPrincipalContext.Provider>
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
  const serverPrincipal = useContext(ServerPrincipalContext);
  const { data: session, isPending } = useSession();

  if (!isPending) {
    return { userId: session?.user.id, isPending: false };
  }
  if (serverPrincipal) {
    return { userId: serverPrincipal.userId, isPending: false };
  }
  return { userId: undefined, isPending: true };
}

/** The session rendered by the platform until Better Auth resolves the browser's session. */
export function usePrincipalSession() {
  const serverPrincipal = useContext(ServerPrincipalContext);
  const { data: session, isPending } = useSession();
  if (isPending && serverPrincipal) return serverPrincipal;
  return { userId: session?.user.id, sessionId: session?.session.id };
}
