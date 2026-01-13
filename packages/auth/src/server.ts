import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, genericOAuth } from "better-auth/plugins";

import { db } from "@repo/database";
import * as schema from "@repo/database/schema";

import { sendOtpEmail } from "./email/otpEmail";
import { orcidProvider } from "./providers/orcid";

const useSecureCookies = process.env.NODE_ENV === "production";
const environmentPrefix = process.env.ENVIRONMENT_PREFIX ?? "dev";
const clientUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3020";
const cookieDomain = process.env.COOKIE_DOMAIN;

// Configure custom OAuth providers (ORCID via genericOAuth plugin)
const customOAuthProviders = [];

if (process.env.AUTH_ORCID_ID && process.env.AUTH_ORCID_SECRET) {
  customOAuthProviders.push(
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
    // Add custom OAuth providers using the generic OAuth plugin
    ...(customOAuthProviders.length > 0
      ? [
          genericOAuth({
            config: customOAuthProviders,
          }),
        ]
      : []),
  ],
  // Configure built-in social providers
  socialProviders: {
    ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
      ? {
          github: {
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
          },
        }
      : {}),
  },
});

export type Auth = typeof auth;
