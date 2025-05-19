import NextAuth from "next-auth";

import { adapter } from "./adapter";
import { authConfig } from "./config";

const { auth: middleware } = NextAuth(authConfig);

const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: { strategy: "jwt" },
  ...authConfig,
});

export { handlers, auth, signIn, signOut, middleware };
