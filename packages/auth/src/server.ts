import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { admin, emailOTP, genericOAuth, organization } from "better-auth/plugins";

import { db, and, eq, profiles, ensurePersonalOrganization } from "@repo/database";
import * as schema from "@repo/database/schema";

import { sendInvitationEmail } from "./email/invitationEmail";
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
    level: "info",
    disabled: false,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      rateLimit: schema.rateLimits,
      organization: schema.organizations,
      member: schema.organizationMembers,
      invitation: schema.organizationInvitations,
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
    // Sliding session: 30-day absolute lifetime with daily rolling renewal.
    // While the user is active, every authenticated request inside
    // `updateAge` extends the cookie expiry, so active users effectively
    // never get logged out. After 30 days of inactivity the session ends.
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day (slide the session forward daily)
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24, // 1 day
    },
  },
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
      // Less restrictive for session checks
      "/get-session": false, // Disable rate limiting for session checks
    },
  },
  user: {
    changeEmail: {
      enabled: true,
    },
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
            senderName: "openJII",
            baseUrl: clientUrl,
          });
        }
      },
    }),
    // Organization tier: per-org membership + roles (owner/admin/member).
    // Resources are org-owned; org membership grants baseline access.
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
      async sendInvitationEmail(data) {
        const emailServer = process.env.AUTH_EMAIL_SERVER;
        const emailFrom = process.env.AUTH_EMAIL_FROM;
        if (!emailServer || !emailFrom) {
          return;
        }
        await sendInvitationEmail({
          to: data.email,
          inviteLink: `${clientUrl}/en-US/platform/accept-invitation/${data.id}`,
          organizationName: data.organization.name,
          inviterName: data.inviter.user.name,
          emailServer,
          emailFrom,
          senderName: "openJII",
        });
      },
    }),
    // Platform tier: global admin role, ban controls, impersonation.
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
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
  // Database lifecycle hooks: provision a personal organization for every user
  // and set it as the active organization atomically when a session is created
  // (avoids the cookie-cache lag of a post-hoc update).
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
    session: {
      create: {
        before: async (session) => {
          try {
            const organizationId = await ensurePersonalOrganization(db, { id: session.userId });
            return { data: { ...session, activeOrganizationId: organizationId } };
          } catch (err) {
            console.warn("Failed to set active organization on session:", err);
            return;
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

      const isSignInCallback =
        ctx.path.startsWith("/callback/") || ctx.path.startsWith("/oauth2/callback/");

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
