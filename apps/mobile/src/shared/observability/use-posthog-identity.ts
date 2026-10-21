import type PostHog from "posthog-react-native";
import { useEffect, useRef } from "react";

/**
 * Names the signed-in user by id, never by email, so PostHog counts people rather than installs;
 * a sign-out resets to an anonymous id.
 */
export function usePostHogIdentity(
  posthog: Pick<PostHog, "identify" | "reset"> | undefined,
  userId: string | undefined,
  isGuest = false,
): void {
  const identified = useRef<string | undefined>(undefined);
  const guest = useRef(false);

  useEffect(() => {
    if (!posthog || (userId === identified.current && isGuest === guest.current)) {
      return;
    }

    if (userId) {
      if (isGuest) posthog.identify(userId, { is_guest: true });
      else if (guest.current) posthog.identify(userId, { is_guest: false });
      else posthog.identify(userId);
    } else {
      posthog.reset();
    }
    identified.current = userId;
    guest.current = isGuest;
  }, [posthog, userId, isGuest]);
}
