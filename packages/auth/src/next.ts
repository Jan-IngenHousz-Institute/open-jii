import type { CommonProviderOptions } from "@auth/core/providers";
import NextAuth from "next-auth";
import { AuthError } from "next-auth";

import { adapter } from "./adapter";
import { authConfig } from "./config";

const { auth: middleware } = NextAuth(authConfig);

const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
});

const providerMap = authConfig.providers
  .map((provider) => {
    const simpleProvider = provider as unknown as CommonProviderOptions;
    return { id: simpleProvider.id, name: simpleProvider.name };
  })
  .filter((provider) => provider.id !== "credentials");

export { handlers, auth, signIn, signOut, middleware, AuthError, providerMap };
