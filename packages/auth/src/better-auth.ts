import { db } from "@repo/database";
import { users, sessions, accounts, verificationTokens } from "@repo/database/schema";

import { NodeMailerAuthEmailAdapter } from "./adapters/email.adapter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authInstance: any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getAuth = async (): Promise<any> => {
  await Promise.resolve();
  if (authInstance) {
    return authInstance;
  }

  const { betterAuth } = await import("better-auth");
  const { drizzleAdapter } = await import("better-auth/adapters/drizzle");
  const { magicLink } = await import("better-auth/plugins");

  const emailAdapter = new NodeMailerAuthEmailAdapter();

  authInstance = betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        user: users,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        session: sessions,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        account: accounts,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        verification: verificationTokens,
      },
    }),
    advanced: {
      database: {
        generateId: () => crypto.randomUUID(),
      },
    },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? "",
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      },
      // TODO: Add ORCID provider configuration
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, token: _token, url }, _request) => {
          await emailAdapter.sendVerificationEmail(email, url);
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

  // Patch options for @thallesp/nestjs-better-auth compatibility
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  authInstance.options ??= {
    trustedOrigins: [],
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ...authInstance.config,
  };

  return authInstance;
};
