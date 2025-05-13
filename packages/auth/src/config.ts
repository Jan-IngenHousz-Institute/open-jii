import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type {
  DefaultSession,
  NextAuthConfig,
  Session as NextAuthSession,
  User,
} from "next-auth";

import {
  accounts,
  db,
  sessions,
  users,
  verificationTokens,
} from "@repo/database";

declare module "next-auth" {
  /**
   * Returned by `auth`, `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  export interface Session {
    user: {
      id: string;
      /**
       * By default, TypeScript merges new interface properties and overwrites existing ones.
       * In this case, the default session user properties will be overwritten,
       * with the new ones defined above. To keep the default session user properties,
       * you need to add them back into the newly declared interface.
       */
    } & DefaultSession["user"];
  }
  export interface SessionUser extends User {
    id: string;
  }
}

export type { Session, SessionUser, DefaultSession, User } from "next-auth";

const adapter = DrizzleAdapter(db as any, {
  usersTable: users as any,
  accountsTable: accounts as any,
  sessionsTable: sessions as any,
  verificationTokensTable: verificationTokens as any,
});

export const isSecureContext = process.env.NODE_ENV !== "development";

export const authConfig = {
  adapter,
  secret: process.env.AUTH_SECRET,
  providers: [],
  trustHost: true,
  callbacks: {
    session: (opts) => {
      if (!("user" in opts))
        throw new Error("unreachable with session strategy");

      return {
        ...opts.session,
        user: {
          ...opts.session.user,
          id: opts.user.id,
        },
      };
    },
  },
} satisfies NextAuthConfig;

export const validateToken = async (
  token: string,
): Promise<NextAuthSession | null> => {
  const sessionToken = token.slice("Bearer ".length);
  const session = await adapter.getSessionAndUser?.(sessionToken);
  return session
    ? {
        user: {
          ...session.user,
        },
        expires: session.session.expires.toISOString(),
      }
    : null;
};

export const invalidateSessionToken = async (token: string) => {
  const sessionToken = token.slice("Bearer ".length);
  await adapter.deleteSession?.(sessionToken);
};
