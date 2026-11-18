import { apiKey } from "@better-auth/api-key";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { genericOAuth, lastLoginMethod } from "better-auth/plugins";

import { db, and, eq, profiles, ensurePersonalOrganization } from "@repo/database";

import { getApiKeyForSessionCheck } from "./api-key-session";
import { openJiiEmailOTP } from "./email-otp";
import { sendConfirmEmailOtpEmail } from "./email/confirmEmailOtpEmail";
import { sendOtpEmail } from "./email/otpEmail";
import { authSchema, sharedAuthOptions } from "./options";
import { openJiiOrganization } from "./organization/plugin";
import { legacyOAuth2SignIn } from "./providers/legacy-oauth2-sign-in";
import { orcidProvider } from "./providers/orcid";

const environmentPrefix = process.env.ENVIRONMENT_PREFIX ?? "dev";
const clientUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3020";
const cookieDomain = process.env.COOKIE_DOMAIN;

// WebAuthn rpID must be a registrable suffix of the WEB origin's hostname
// (ceremonies run on the web app, not on baseURL which is the backend).
// Subdomain deployments share COOKIE_DOMAIN; dev falls back to "localhost".
const passkeyRpId = cookieDomain?.replace(/^\./, "") ?? new URL(clientUrl).hostname;

// Configure custom OAuth providers (ORCID via genericOAuth plugin)
const customOAuthProviders: ReturnType<typeof orcidProvider>[] = [];

if (process.env.AUTH_ORCID_ID && process.env.AUTH_ORCID_SECRET) {
  customOAuthProviders.push(
    orcidProvider({
      clientId: process.env.AUTH_ORCID_ID,
      clientSecret: process.env.AUTH_ORCID_SECRET,
      environment: process.env.AUTH_ORCID_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
      // For a registry that refuses the backend's own callback (the sandbox takes neither
      // http nor localhost), the address registered there; unset everywhere else.
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- an empty value must fall back to the library's own callback, which `??` would not.
      redirectURI: process.env.AUTH_ORCID_REDIRECT_URI || undefined,
    }),
  );
}

export const auth = betterAuth({
  ...sharedAuthOptions,
  logger: {
    level: "info",
    disabled: false,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  secret: process.env.AUTH_SECRET,
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
  rateLimit: {
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
      "/email-otp/request-email-change": {
        window: 60,
        max: 3,
      },
      "/email-otp/change-email": {
        window: 60,
        max: 10,
      },
      // Less restrictive for session checks
      "/get-session": false, // Disable rate limiting for session checks
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
    database: sharedAuthOptions.advanced.database,
  },
  plugins: [
    expo(), // Add Expo plugin for mobile app support
    openJiiEmailOTP({
      playReview: {
        email: process.env.AUTH_PLAY_REVIEW_EMAIL,
        otp: process.env.AUTH_PLAY_REVIEW_OTP,
      },
      async sendEmail({ email, otp, type }) {
        const emailServer = process.env.AUTH_EMAIL_SERVER;
        const emailFrom = process.env.AUTH_EMAIL_FROM;

        if (emailServer && emailFrom) {
          const send = type === "change-email" ? sendConfirmEmailOtpEmail : sendOtpEmail;
          await send({
            to: email,
            otp,
            emailServer,
            emailFrom,
            senderName: "openJII",
            baseUrl: clientUrl,
          });
        }
      },
    }),
    // Organization tier: per-org membership + roles (owner/admin/member).
    // Resources are org-owned; org membership grants baseline access.
    openJiiOrganization(),
    // Add custom OAuth providers using the generic OAuth plugin
    ...(customOAuthProviders.length > 0
      ? [
          genericOAuth({
            config: customOAuthProviders,
          }),
          legacyOAuth2SignIn(),
        ]
      : []),
    // Personal API keys: a valid x-api-key header authenticates REST
    // requests as the owning user (mocked session, no activeOrganizationId).
    apiKey({
      defaultPrefix: "jii_",
      requireName: true,
      keyExpiration: {
        defaultExpiresIn: null,
        minExpiresIn: 1,
        maxExpiresIn: 365,
      },
      // Plugin default is 10 requests/day per key.
      rateLimit: {
        enabled: true,
        timeWindow: 60 * 1000,
        maxRequests: 100,
      },
      customAPIKeyGetter: getApiKeyForSessionCheck,
      enableSessionForAPIKeys: true,
    }),
    passkey({
      rpID: passkeyRpId,
      rpName: "openJII",
      origin: clientUrl,
    }),
    lastLoginMethod({
      customResolveMethod: (ctx) => {
        if (ctx.path.startsWith("/callback/")) return ctx.path.split("/callback/")[1];
        if (ctx.path === "/sign-in/email-otp") return "email";
        if (ctx.path === "/passkey/verify-authentication") return "passkey";
        return null;
      },
    }),
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
  // Database lifecycle hooks: provision a personal organization for every user
  // on sign-up. Authorization always runs against a resource's owning org, so
  // there is no "active organization" concept on the session — new resources
  // default to the creator's personal org (or an explicit organizationId).
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await ensurePersonalOrganization(db, { id: user.id, name: user.name });
          } catch (err) {
            console.warn("Failed to provision personal organization for user:", err);
          }
        },
      },
    },
  },
  // Lifecycle hooks
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Trigger on any sign-in method (social, email OTP, etc.)
      const isSignIn = ["/sign-in/social", "/sign-in/email-otp", "/sign-in/email"].includes(
        ctx.path,
      );

      const isSignInCallback = ctx.path.startsWith("/callback/");

      if (isSignIn || isSignInCallback) {
        try {
          const session = ctx.context.newSession;
          if (session?.user.id) {
            // Reactivate user profile on successful sign-in
            await db
              .update(profiles)
              .set({ activated: true })
              .where(and(eq(profiles.userId, session.user.id), eq(profiles.activated, false)));
          }
        } catch (err) {
          console.warn("Failed to reactivate profile on sign-in:", err);
        }
      }
    }),
  },
});

export type Auth = typeof auth;
