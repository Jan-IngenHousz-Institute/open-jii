import { getAuthClient, reloadSessionFromServer } from "~/features/auth/services/auth";
import { AUTH_REQUEST_TIMEOUT_MS } from "~/features/auth/services/auth-request-timeout";
import { orpcClient } from "~/shared/api/orpc";

export interface ProfileInput {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export function requestRegistrationEmailCode(newEmail: string) {
  return getAuthClient().emailOtp.requestEmailChange({
    newEmail,
    fetchOptions: { timeout: AUTH_REQUEST_TIMEOUT_MS },
  });
}

export function verifyRegistrationEmailCode(newEmail: string, otp: string) {
  return getAuthClient().emailOtp.changeEmail({
    newEmail,
    otp,
    fetchOptions: { timeout: AUTH_REQUEST_TIMEOUT_MS },
  });
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
