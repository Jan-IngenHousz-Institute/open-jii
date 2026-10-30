import { usePrincipal } from "@/components/auth/principal-context";
import { z } from "zod";

import type { PersonLike, Translate } from "../person-name";
import { personName } from "../person-name";

const emailSchema = z.string().email();

export function isEmailAddress(value: string): boolean {
  return emailSchema.safeParse(value.trim()).success;
}

export type PickerRowKind = "user" | "team" | "organization";

export interface PickerRow<V> {
  key: string;
  kind: PickerRowKind;
  label: string;
  /** User rows only: what the shared identity component draws. */
  person: PersonLike | null;
  /** Users: `undefined` shows their email. Teams and organizations: their second line. */
  identityLine?: string | null;
  badges: string[];
  unavailableReason: string | null;
  value: V;
}

/**
 * Leaves the viewer out and keeps the search's order. Nobody else is dropped: an
 * unpickable candidate stays where relevance put it, greyed out with its context's reason.
 */
export function usePickerRows<C, V>(
  candidates: readonly C[],
  describe: (candidate: C) => PickerRow<V>,
): PickerRow<V>[] {
  const { userId: viewerId } = usePrincipal();
  return candidates
    .map(describe)
    .filter(
      (row) => !(row.kind === "user" && viewerId !== undefined && row.person?.id === viewerId),
    );
}

interface SearchedUser {
  userId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  matchedEmail: boolean;
  avatarUrl?: string | null;
}

/**
 * A searched person's row, pickable unless given a reason. The line under them is their
 * email, the match hint when it is hidden but the full address was typed, or none.
 */
export function describeSearchedUser<U extends SearchedUser>(
  user: U,
  {
    typedEmail,
    t,
    reason = null,
    badges = [],
  }: { typedEmail: string | null; t: Translate; reason?: string | null; badges?: string[] },
): PickerRow<U> {
  const person = {
    id: user.userId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };
  return {
    key: user.userId,
    kind: "user",
    label: personName(person, t),
    person,
    identityLine: user.email
      ? undefined
      : user.matchedEmail && typedEmail
        ? t("common.emailMatched")
        : null,
    badges,
    unavailableReason: reason,
    value: user,
  };
}

export type EmailInviteReason = "invited" | "member" | "registered" | "noMatch";

/**
 * Whether a typed address gets the invitation row, and what the list says about it
 * otherwise. A failed search cannot rule out an account, so it never offers one.
 */
export function emailInviteFor({
  allowed,
  typed,
  settled,
  isError,
  candidates,
  invitedEmails,
  memberEmails = [],
}: {
  allowed: boolean;
  typed: string;
  /** The search's answer is for exactly `typed`. */
  settled: boolean;
  isError: boolean;
  candidates: readonly { email: string | null; matchedEmail: boolean }[];
  invitedEmails: readonly string[];
  memberEmails?: readonly string[];
}): { offer: boolean; reason: EmailInviteReason } {
  const address = typed.trim().toLowerCase();
  if (!isEmailAddress(address)) return { offer: false, reason: "noMatch" };

  const listed = (emails: readonly string[]) => emails.some((e) => e.toLowerCase() === address);
  const reason: EmailInviteReason =
    settled &&
    candidates.some(
      (candidate) => candidate.matchedEmail || candidate.email?.toLowerCase() === address,
    )
      ? "registered"
      : listed(invitedEmails)
        ? "invited"
        : listed(memberEmails)
          ? "member"
          : "noMatch";

  return { offer: allowed && !isError && reason === "noMatch", reason };
}
