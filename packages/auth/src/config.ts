/* eslint-disable turbo/no-undeclared-env-vars */
import type { JWT } from "@auth/core/jwt";
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

const useSecureCookies = process.env.NODE_ENV === "production";
const cookiePrefix = useSecureCookies ? "__Secure-" : "";

// Auth config used across the application
export const baseAuthConfig = {
  secret: process.env.AUTH_SECRET,
  providers: [GitHub],
  trustHost: true,
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        domain: process.env.COOKIE_DOMAIN ?? undefined,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}authjs.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        domain: process.env.COOKIE_DOMAIN ?? undefined,
      },
    },
    csrfToken: {
      name: `${useSecureCookies ? "__Host-" : ""}authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    session({
      session,
      token,
    }: {
      session: DefaultSession;
      token: JWT & { id?: string };
    }) {
      if (token.id && session.user) {
        session.user.id = token.id;
      }
      return session;
    },
  },
} satisfies NextAuthConfig & ExpressAuthConfig;
