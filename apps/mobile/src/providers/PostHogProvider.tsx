import { PostHogProvider as RNPostHogProvider } from "posthog-react-native";
import { useRef, type ReactNode } from "react";
import { getPostHogClient } from "~/lib/posthog";

/**
 * Wraps the app with PostHog's context provider.
 * Initializes the client async, then passes it down via context
 * so usePostHog() works throughout the app.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const client = useRef(getPostHogClient())

  if (!client.current) {
    // Render children immediately — analytics just won't be available yet
    return <>{children}</>;
  }

  return <RNPostHogProvider client={client.current}>{children}</RNPostHogProvider>;
}
