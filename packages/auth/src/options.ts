/**
 * The parts of the auth configuration a test on the real database must build from rather
 * than copy, so a change to them reaches the server and those tests alike. Its own entry
 * rather than part of `@repo/auth/server`, so the backend can use it without loading the
 * auth instance, which tests mock.
 */
import type { BetterAuthOptions } from "better-auth";

import * as schema from "@repo/database/schema";

export const authSchema = {
  user: schema.users,
  session: schema.sessions,
  account: schema.accounts,
  verification: schema.verifications,
  rateLimit: schema.rateLimits,
  organization: schema.organizations,
  member: schema.organizationMembers,
  invitation: schema.organizationInvitations,
  team: schema.teams,
  teamMember: schema.teamMembers,
  apikey: schema.apiKeys,
  passkey: schema.passkeys,
};

export const sharedAuthOptions = {
  basePath: "/api/v1/auth",
  emailAndPassword: {
    enabled: false,
  },
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
  account: {
    accountLinking: {
      enabled: true,
      // Applies only to an explicit link from a signed-in account. Linking at
      // sign-in still needs the same verified address on both sides.
      allowDifferentEmails: true,
      // The library refuses to unlink a person's last account row; the backend
      // replaces that count with its own check that a way to sign in remains.
      allowUnlinkingAll: true,
      // A private ORCID email reaches us as the bare iD, unverified, which the
      // library refuses to link from an untrusted provider. orcidProvider drops
      // unverified emails itself, so trusting ORCID admits no unverified address.
      // The placeholder iD is safe to trust only while no verified user can hold a
      // non-address as its email. The only path that sets a user's email to something
      // else is the email-code change, which takes only an address and proves it first.
      trustedProviders: ["orcid"],
    },
  },
  user: {
    // As configured this route cannot change an address: it needs an
    // emailVerification.sendVerificationEmail sender and none is set. An address
    // changes only through the email-code change in openJiiEmailOTP.
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
    database: {
      generateId: false, // Let Postgres generate UUIDs via defaultRandom()
    },
  },
} satisfies Partial<BetterAuthOptions>;
