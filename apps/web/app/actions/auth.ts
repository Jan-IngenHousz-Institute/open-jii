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

/**
 * Resets the `registered` flag to false so the user is redirected
 * back to the registration flow to provide a valid email address.
 */
export async function resetRegistrationStatus() {
  const headersList = await headers();
  return await authClient.updateUser({ registered: false }, { headers: headersList });
}
