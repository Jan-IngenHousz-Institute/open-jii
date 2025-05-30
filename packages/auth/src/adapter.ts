/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DrizzleAdapter } from "@auth/drizzle-adapter";

import {
  accounts,
  db,
  sessions,
  users,
  verificationTokens,
} from "@repo/database";

export const adapter = DrizzleAdapter(db as any, {
  usersTable: users as any,
  accountsTable: accounts as any,
  sessionsTable: sessions as any,
  verificationTokensTable: verificationTokens as any,
});
// export const validateToken = async (token: string): Promise<Session | null> => {
//   const sessionToken = token.slice("Bearer ".length);
//   const session = await adapter.getSessionAndUser?.(sessionToken);
//   return session
//     ? {
//         user: {
//           ...session.user,
//         },
//         expires: session.session.expires.toISOString(),
//       }
//     : null;
// };

// export const invalidateSessionToken = async (token: string) => {
//   const sessionToken = token.slice("Bearer ".length);
//   await adapter.deleteSession?.(sessionToken);
// };
