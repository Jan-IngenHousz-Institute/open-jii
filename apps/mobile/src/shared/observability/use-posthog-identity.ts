import type PostHog from "posthog-react-native";
import { useEffect, useRef } from "react";

/**
 * Names the signed-in user by id, never by email, so PostHog counts people rather than installs;
 * a sign-out resets to an anonymous id.
 */
export function usePostHogIdentity(
  posthog: Pick<PostHog, "identify" | "reset"> | undefined,
  userId: string | undefined,
): void {
  const identified = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!posthog || userId === identified.current) {
      return;
    }

    if (userId) {
      posthog.identify(userId);
    } else {
      posthog.reset();
    }
    identified.current = userId;
  }, [posthog, userId]);
}
