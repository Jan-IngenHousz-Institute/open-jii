import { reloadSessionFromServer } from "~/features/auth/services/auth";
import { orpcClient } from "~/shared/api/orpc";

export interface CompleteRegistrationInput {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

/** Saving the profile is what registers the account server-side. */
export async function completeRegistration(input: CompleteRegistrationInput) {
  await orpcClient.users.createUserProfile(input);

  const user = await reloadSessionFromServer();
  if (!user?.registered) {
    throw new Error("The session still reads the account as unregistered");
  }
}

export function subscribeToNewsletter() {
  return orpcClient.newsletter.subscribeDirect();
}
