import GitHub from "@auth/core/providers/github";
import type { NextAuthConfig, NextAuthResult } from "next-auth";
import NextAuth from "next-auth";
import { AuthError } from "next-auth";

import { adapter, lambdaAdapter } from "./adapter";
import { baseAuthConfig } from "./config";

interface InitAuthParams {
  authSecrets: Record<string, string>;
  dbSecrets: Record<string, string>;
  isLambda: boolean;
}

export type NextAuth = NextAuthResult & {
  providerMap: { id: string; name: string }[];
};

export function initAuth({
  authSecrets,
  dbSecrets,
  isLambda,
}: InitAuthParams): NextAuth {
  const authConfig: NextAuthConfig = {
    ...baseAuthConfig,
    secret: authSecrets.AUTH_SECRET || process.env.AUTH_SECRET,
    providers: [
      GitHub({
        clientId: authSecrets.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID,
        clientSecret:
          authSecrets.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET,
      }),
    ],
    adapter: isLambda ? lambdaAdapter(dbSecrets) : adapter,
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
  };

  const providerMap = authConfig.providers
    .map((provider) => {
      if (typeof provider === "function") {
        const providerData = provider();
        return { id: providerData.id, name: providerData.name };
      } else {
        return { id: provider.id, name: provider.name };
      }
    })
    .filter((provider) => provider.id !== "credentials");

  const nextAuth = NextAuth(authConfig);

  return { ...nextAuth, providerMap };
}

export { AuthError, NextAuthResult };
