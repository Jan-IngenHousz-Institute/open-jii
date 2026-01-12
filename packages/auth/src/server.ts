import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import type { BetterAuthOptions } from "better-auth/types";

import { db } from "@repo/database";
import * as schema from "@repo/database/schema";

import { sendOtpEmail } from "./email/otpEmail";
import { githubProvider } from "./providers/github";
import { orcidProvider } from "./providers/orcid";

const useSecureCookies = process.env.NODE_ENV === "production";
const environmentPrefix = process.env.ENVIRONMENT_PREFIX ?? "dev";
const clientUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3020";
const cookieDomain = process.env.COOKIE_DOMAIN;

// Configure social providers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const socialProviders: any[] = [];

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  socialProviders.push(
    githubProvider({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  );
}

if (process.env.AUTH_ORCID_ID && process.env.AUTH_ORCID_SECRET) {
  socialProviders.push(
    orcidProvider({
      clientId: process.env.AUTH_ORCID_ID,
      clientSecret: process.env.AUTH_ORCID_SECRET,
      environment: process.env.AUTH_ORCID_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
    }),
  );
}

export const auth = betterAuth({
  logger: {
    level: "debug",
    disabled: false,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  secret: process.env.AUTH_SECRET,
  basePath: "/api/v1/auth",
  baseURL: apiUrl, // Points to the backend where auth runs
  trustedOrigins: [clientUrl], // Trusts the frontend calls
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (update session every day)
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  user: {
    additionalFields: {
      registered: {
        type: "boolean",
        defaultValue: false,
        required: false,
      },
    },
  },
  advanced: {
    cookiePrefix: `${useSecureCookies ? "__Secure-" : ""}better-auth.${environmentPrefix}`,
    useSecureCookies,
    ...(cookieDomain ? { cookieDomain } : {}),
    database: {
      generateId: false, // Let Postgres generate UUIDs via defaultRandom()
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        const emailServer = process.env.AUTH_EMAIL_SERVER;
        const emailFrom = process.env.AUTH_EMAIL_FROM;

        if (emailServer && emailFrom) {
          await sendOtpEmail({
            to: email,
            otp,
            emailServer,
            emailFrom,
            baseUrl: clientUrl,
          });
        }
      },
    }),
  ],
  socialProviders: Object.fromEntries(
    socialProviders.map((provider: { id: string }) => [provider.id, provider]),
  ) as BetterAuthOptions["socialProviders"],
});

export type Auth = typeof auth;
