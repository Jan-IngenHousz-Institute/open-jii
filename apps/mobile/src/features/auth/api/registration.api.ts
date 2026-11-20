import { getAuthClient } from "~/features/auth/services/auth";
import { orpcClient } from "~/shared/api/orpc";

export interface CompleteRegistrationInput {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

/**
 * Saving the profile is what registers the account server-side. The session cookie caches the user
 * for a day, so it is re-read from the database before the app is told the session changed.
 */
export async function completeRegistration(input: CompleteRegistrationInput) {
  await orpcClient.users.createUserProfile(input);

  const authClient = getAuthClient();
  const refreshed = await authClient.getSession({ query: { disableCookieCache: true } });
  if (refreshed.error || !refreshed.data?.user.registered) {
    throw new Error(refreshed.error?.message ?? "The account is still not registered");
  }
  authClient.$store.notify("$sessionSignal");
}

export function subscribeToNewsletter() {
  return orpcClient.newsletter.subscribeDirect();
}
