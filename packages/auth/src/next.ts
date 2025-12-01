import type { Provider } from "@auth/core/providers";
import GitHub from "@auth/core/providers/github";
import Nodemailer from "@auth/core/providers/nodemailer";
import type { NextAuthConfig, NextAuthResult } from "next-auth";
import NextAuth from "next-auth";
import { AuthError } from "next-auth";

import { db, eq, lambdaDb, profiles } from "@repo/database";

import { adapter, lambdaAdapter } from "./adapter";
import { baseAuthConfig } from "./config";
import { sendVerificationRequest } from "./email/verificationRequest";
import ORCID from "./providers/orcid";

interface InitAuthParams {
  authSecrets: Record<string, string>;
  dbSecrets: Record<string, string>;
  sesSecrets: Record<string, string>;
  isLambda: boolean;
}

export type NextAuth = NextAuthResult & {
  providerMap: { id: string; name: string }[];
};

export function initAuth({
  authSecrets,
  dbSecrets,
  sesSecrets,
  isLambda,
}: InitAuthParams): NextAuth {
  const providers: Provider[] = [
    GitHub({
      clientId: authSecrets.AUTH_GITHUB_ID || process.env.AUTH_GITHUB_ID,
      clientSecret: authSecrets.AUTH_GITHUB_SECRET || process.env.AUTH_GITHUB_SECRET,
    }),
  ];

  if (authSecrets.AUTH_ORCID_ID || process.env.AUTH_ORCID_ID) {
    providers.push(
      ORCID({
        clientId: authSecrets.AUTH_ORCID_ID || process.env.AUTH_ORCID_ID,
        clientSecret: authSecrets.AUTH_ORCID_SECRET || process.env.AUTH_ORCID_SECRET,
        environment:
          authSecrets.AUTH_ORCID_ENVIRONMENT === "sandbox" ||
          process.env.AUTH_ORCID_ENVIRONMENT === "sandbox"
            ? "sandbox"
            : "production",
      }),
    );
  }

  if (
    (sesSecrets.AUTH_EMAIL_SERVER || process.env.AUTH_EMAIL_SERVER) &&
    (sesSecrets.AUTH_EMAIL_FROM || process.env.AUTH_EMAIL_FROM)
  ) {
    providers.push(
      Nodemailer({
        server: sesSecrets.AUTH_EMAIL_SERVER || process.env.AUTH_EMAIL_SERVER,
        from: sesSecrets.AUTH_EMAIL_FROM || process.env.AUTH_EMAIL_FROM,
        sendVerificationRequest,
      }),
    );
  }

  const authConfig: NextAuthConfig = {
    ...baseAuthConfig,
    secret: authSecrets.AUTH_SECRET || process.env.AUTH_SECRET,
    providers,
    adapter: isLambda ? lambdaAdapter(dbSecrets) : adapter,
    session: { strategy: "jwt" },
    pages: { signIn: "/login", verifyRequest: "/verify-request" },
    events: {
      async signIn({ user }) {
        try {
          if (user.id) {
            const dbInstance = isLambda ? lambdaDb(dbSecrets) : db;
            await dbInstance
              .update(profiles)
              .set({ activated: true })
              .where(eq(profiles.userId, user.id));
          }
        } catch (err) {
          console.warn("Failed to reactivate profile on sign-in:", err);
        }
      },
    },
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
