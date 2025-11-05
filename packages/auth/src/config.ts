import GitHub from "@auth/core/providers/github";
import type { ExpressAuthConfig } from "@auth/express";
import type { NextAuthConfig } from "next-auth";

// Reactivate user on successful sign in
import { db, profiles, eq } from "@repo/database";

import { isSession } from "./types";

const useSecureCookies = process.env.NODE_ENV === "production";
const cookiePrefix = useSecureCookies ? "__Secure-" : "";
const environmentPrefix = process.env.ENVIRONMENT_PREFIX ?? "dev";

// Auth config used across the application
export const baseAuthConfig = {
  secret: process.env.AUTH_SECRET,
  providers: [GitHub],
  trustHost: true,
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}authjs.${environmentPrefix}.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        domain: process.env.COOKIE_DOMAIN ?? undefined,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}authjs.${environmentPrefix}.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        domain: process.env.COOKIE_DOMAIN ?? undefined,
      },
    },
    csrfToken: {
      name: `${useSecureCookies ? "__Host-" : ""}authjs.${environmentPrefix}.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (user) {
        token.id = user.id;
        token.registered = user.registered;
        // token.role = user.role;
      }

      if (trigger === "update" && isSession(session)) {
        token.registered = session.user.registered;
      }

      return token;
    },

    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id;
        session.user.registered = token.registered;
        // session.user.role = token.role;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      try {
        if (user.id) {
          await db.update(profiles).set({ activated: true }).where(eq(profiles.userId, user.id));
        }
      } catch (err) {
        console.warn("Failed to reactivate profile on sign-in:", err);
      }
    },
  },
} satisfies NextAuthConfig & ExpressAuthConfig;
