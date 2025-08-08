import GitHub from "@auth/core/providers/github";
import type { ExpressAuthConfig } from "@auth/express";
import type { NextAuthConfig } from "next-auth";

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
    jwt({ token, user }) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (user) {
        token.id = user.id;
        token.registered = user.registered;
        // token.role = user.role;
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
} satisfies NextAuthConfig & ExpressAuthConfig;
