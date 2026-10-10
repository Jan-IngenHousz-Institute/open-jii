import { headers } from "next/headers";
import { cache } from "react";

import { authClient } from "@repo/auth/client";
import type { Session } from "@repo/auth/types";

/**
 * Get the current session from Better Auth backend
 * This is a server-side function for use in Server Components and Server Actions.
 * Cached per request: a layout and its page both ask, and each ask is a backend round trip.
 */
export const auth = cache(async (): Promise<Session | null> => {
  try {
    const headersList = await headers();

    // Use the authClient to fetch the session, passing the headers to forward cookies
    const { data } = await authClient.getSession({
      fetchOptions: {
        headers: headersList,
      },
    });

    return data;
  } catch (error) {
    console.error("Session fetch error:", error);
    return null;
  }
});
