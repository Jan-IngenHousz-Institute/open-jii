import { PostHogProvider as RNPostHogProvider } from "posthog-react-native";
import { useEffect, useState, type ReactNode } from "react";
import PostHog from "posthog-react-native";
import { getPostHogClient } from "~/lib/posthog";

/**
 * Wraps the app with PostHog's context provider.
 * Initializes the client async, then passes it down via context
 * so usePostHog() works throughout the app.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<PostHog | null>(null);

  useEffect(() => {
    getPostHogClient()
      .then(setClient)
      .catch((err) => console.warn("[PostHog] init failed:", err));
  }, []);

  if (!client) {
    // Render children immediately — analytics just won't be available yet
    return <>{children}</>;
  }

  return <RNPostHogProvider client={client}>{children}</RNPostHogProvider>;
}
