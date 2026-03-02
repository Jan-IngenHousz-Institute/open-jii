import { PostHogProvider as RNPostHogProvider } from "posthog-react-native";
import { useRef, type ReactNode } from "react";
import { getPostHogClient } from "~/lib/posthog";

export function PostHogProvider({ children }: { children: ReactNode }) {
  const client = useRef(getPostHogClient());

  return <RNPostHogProvider client={client.current}>{children}</RNPostHogProvider>;
}
