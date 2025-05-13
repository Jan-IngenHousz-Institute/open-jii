import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { authConfig } from "./config";

const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [GitHub, Google],
});

export { handlers, auth, signIn, signOut };
