import type { DefaultSession, DefaultUser } from "@auth/core/types";
import type { DefaultJWT } from "next-auth/jwt";

declare module "@auth/core/jwt" {
  /** Augment JWT to include user's id and additional properties */
  interface JWT extends Record<string, unknown>, DefaultJWT {
    id: string;
    registered: boolean;
    // Example on how to extend the User type
    // role?: "admin" | "user";
  }
}

declare module "@auth/core/types" {
  /**
   * Returned by `auth`, `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session extends DefaultSession {
    user: User;
  }

  /** Augment the default `User` type to match our application's `User` */
  interface User extends DefaultUser {
    id: string;
    registered: boolean;
    // Example on how to extend the User type
    // role?: "admin" | "user";
  }
}

declare module "@auth/core/adapters" {
  /** Augment the default `AdapterUser` to match our application's `User` */
  interface AdapterUser extends User {
    id: string;
    registered: boolean;
    // Example on how to extend the User type
    // role?: "admin" | "user";
  }
}

export interface User extends DefaultUser {
  id: string;
  registered: boolean;
  // Example on how to extend the User type
  // role?: "admin" | "user";
}

export interface Session extends DefaultSession {
  user: User;
}
