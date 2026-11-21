import { reloadSessionFromServer } from "~/features/auth/services/auth";
import { orpcClient } from "~/shared/api/orpc";

export interface ProfileInput {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

/** Saving the profile is what registers the account server-side. It is an upsert. */
export function saveProfile(input: ProfileInput) {
  return orpcClient.users.createUserProfile(input);
}

/** Brings the app's session up to date and fails while it still reads the account unregistered. */
export async function confirmRegistered() {
  const user = await reloadSessionFromServer();
  if (!user?.registered) {
    throw new Error("The session still reads the account as unregistered");
  }
}

export function subscribeToNewsletter() {
  return orpcClient.newsletter.subscribeDirect();
}
