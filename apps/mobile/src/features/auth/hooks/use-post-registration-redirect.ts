import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

/**
 * Sends a user who just finished registering to Discover, where they can join an organization or
 * experiment. Fires only on the registration-to-registered transition, never on a plain launch.
 */
export function usePostRegistrationRedirect(isSignedIn: boolean, needsRegistration: boolean) {
  const router = useRouter();
  const wasRegistering = useRef(false);

  useEffect(() => {
    if (!isSignedIn) {
      wasRegistering.current = false;
      return;
    }
    if (needsRegistration) {
      wasRegistering.current = true;
      return;
    }
    if (!wasRegistering.current) return;

    wasRegistering.current = false;
    router.push("/discover");
  }, [isSignedIn, needsRegistration, router]);
}
