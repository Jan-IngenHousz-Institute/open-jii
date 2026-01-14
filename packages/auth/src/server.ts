import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, genericOAuth } from "better-auth/plugins";

import { db } from "@repo/database";
import * as schema from "@repo/database/schema";

import { sendOtpEmail } from "./email/otpEmail";
import { orcidProvider } from "./providers/orcid";

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      rateLimit: schema.rateLimits as any,
    },
  }),
  secret: process.env.AUTH_SECRET,
  basePath: "/api/v1/auth",
  baseURL: apiUrl, // Points to the backend where auth runs
  trustedOrigins: [
    clientUrl,
    "openjii://", // Primary mobile scheme
    "photosynq://", // Secondary mobile scheme
    // Development mode - Expo's exp:// scheme with local IP ranges
    ...(process.env.NODE_ENV === "development"
      ? [
          "exp://", // Trust all Expo URLs (prefix matching)
          "exp://**", // Trust all Expo URLs (wildcard matching)
          "exp://192.168.*.*:*/**", // Trust 192.168.x.x IP range with any port and path
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (update session every day)
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production" || process.env.RATE_LIMIT_ENABLED === "true",
    window: 60, // 60 seconds
    max: 100, // 100 requests per window
    storage: "database", // Use database storage for production reliability
    customRules: {
      // Stricter limits for OTP/email endpoints to prevent abuse
      "/sign-in/email": {
        window: 60, // 1 minute
        max: 5, // 5 attempts per minute
      },
      "/sign-up/email": {
        window: 60,
        max: 5,
      },
      "/email-otp/send-verification-otp": {
        window: 60,
        max: 3, // Very strict - 3 OTP sends per minute
      },
      "/email-otp/verify-email": {
        window: 60,
        max: 10, // Allow more verification attempts
      },
      // Less restrictive for session checks
      "/get-session": false, // Disable rate limiting for session checks
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
    cookiePrefix: `better-auth.${environmentPrefix}`,
    ...(cookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: cookieDomain,
          },
        }
      : {}),
    database: {
      generateId: false, // Let Postgres generate UUIDs via defaultRandom()
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    expo(), // Add Expo plugin for mobile app support
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
