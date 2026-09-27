import { usePostHog } from "posthog-react-native";
import { useSession } from "~/features/auth/hooks/use-session";
import { usePostHogIdentity } from "~/shared/observability/use-posthog-identity";
import { useScreenViews } from "~/shared/observability/use-screen-views";

/** Keeps PostHog's view of who is signed in and which screen is open up to date. */
export function PostHogSession() {
  const posthog = usePostHog();
  const { user } = useSession();

  usePostHogIdentity(posthog, user?.id);
  useScreenViews(posthog);

  return null;
}
