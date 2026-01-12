import { cookies } from "next/headers";
import { env } from "~/env";

import type { Session } from "@repo/auth/types";

const BACKEND_URL = env.NEXT_PUBLIC_API_URL;

/**
 * Get the current session from Better Auth backend
 * This is a server-side function for use in Server Components and Server Actions
 */
export async function auth(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("better-auth.session-token")?.value;

    if (!sessionToken) {
      return null;
    }

    const response = await fetch(`${BACKEND_URL}/auth/session`, {
      headers: {
        Cookie: `better-auth.session-token=${sessionToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as Session;
  } catch (error) {
    console.error("Session fetch error:", error);
    return null;
  }
}

/**
 * Provider map for displaying available auth providers
 */
export const providerMap = [
  { id: "github", name: "GitHub" },
  { id: "orcid", name: "ORCID" },
  { id: "email", name: "Email" },
];
