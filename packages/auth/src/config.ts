import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import type {
  DefaultSession,
  NextAuthConfig,
  Session as NextAuthSession,
  User,
} from "next-auth";

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
  providers: [GitHub, Google],
  trustHost: true,
} satisfies NextAuthConfig;
