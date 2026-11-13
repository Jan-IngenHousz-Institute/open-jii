/**
 * Its own entry rather than part of `@repo/auth/server`, so the web can disable a
 * removal and the backend can refuse it by the same rule without loading the auth
 * instance.
 */
import { z } from "zod";

export interface SignInMethods {
  email: string;
  emailVerified: boolean;
  passkeyCount: number;
  /** Row ids of the person's `accounts` rows, not the provider's ids. */
  accountIds: string[];
}

export type SignInMethodRemoval = { kind: "account"; accountId: string } | { kind: "passkey" };

/** An account signed up through ORCID with a private email holds the bare iD as its email. */
export function hasUsableEmail(email: string, emailVerified: boolean) {
  return emailVerified && z.email().safeParse(email).success;
}

export function canRemoveSignInMethod(methods: SignInMethods, removal: SignInMethodRemoval) {
  const passkeyCount =
    removal.kind === "passkey" ? Math.max(methods.passkeyCount - 1, 0) : methods.passkeyCount;
  const accountIds =
    removal.kind === "account"
      ? methods.accountIds.filter((id) => id !== removal.accountId)
      : methods.accountIds;

  return (
    hasUsableEmail(methods.email, methods.emailVerified) ||
    passkeyCount > 0 ||
    accountIds.length > 0
  );
}
