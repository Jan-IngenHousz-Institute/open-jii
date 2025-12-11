import { db } from "@repo/database";
import { users, sessions, accounts, verification } from "@repo/database/schema";

let authInstance: any;

export const getAuth = async () => {
  if (authInstance) {
    return authInstance;
  }

  const { betterAuth } = await import("better-auth");
  const { drizzleAdapter } = await import("better-auth/adapters/drizzle");
  const { magicLink } = await import("better-auth/plugins");

  authInstance = betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
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

  return authInstance;
};
