import GitHub from "@auth/core/providers/github";
import type { ExpressAuthConfig } from "@auth/express";
import type { DefaultSession, NextAuthConfig, User } from "next-auth";

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

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  providers: [GitHub],
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (user) {
        // User is available during sign-in
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig & ExpressAuthConfig;
