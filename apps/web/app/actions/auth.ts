import { headers } from "next/headers";

import { authClient } from "@repo/auth/client";
import type { Session } from "@repo/auth/types";

/**
 * Get the current session from Better Auth backend
 * This is a server-side function for use in Server Components and Server Actions
 */
export async function auth(): Promise<Session | null> {
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
}
