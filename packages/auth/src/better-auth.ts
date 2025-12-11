import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";

import { db } from "@repo/database";
import { user, session, account, verification } from "@repo/database/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    // TODO: Add ORCID provider configuration
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }, request) => {
        // TODO: Integrate with email service (e.g. SES)
        console.log(`Send magic link to ${email}: ${url}`);
      },
    }),
  ],
  user: {
    additionalFields: {
      registered: {
        type: "boolean",
        required: true,
        defaultValue: false,
      },
    },
  },
});
