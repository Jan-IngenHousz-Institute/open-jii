"use client";

import { useLinkedAccounts } from "~/hooks/auth/useLinkedAccounts/useLinkedAccounts";
import { usePasskeys } from "~/hooks/auth/usePasskeys/usePasskeys";

import { useSession } from "@repo/auth/client";
import type { SignInMethods } from "@repo/auth/sign-in-methods";

/**
 * The person's ways to sign in, as `canRemoveSignInMethod` reads them, or `undefined`
 * until the session, the passkeys and the accounts have all loaded. The sign-in methods
 * card keeps Disconnect disabled while this is undefined, so it never flashes enabled. The
 * passkeys card blocks Delete only on a refusal, so a failed accounts read cannot lock it;
 * the server refuses the last way in either way.
 */
export function useSignInMethods(): SignInMethods | undefined {
  const { data: session } = useSession();
  const passkeys = usePasskeys();
  const accounts = useLinkedAccounts();

  if (!session || !passkeys.data || !accounts.data) return undefined;

  return {
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    passkeyCount: passkeys.data.length,
    accountIds: accounts.data.map((account) => account.id),
  };
}
