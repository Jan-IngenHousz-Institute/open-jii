import { PostHogProvider as RNPostHogProvider } from "posthog-react-native";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { getPostHogClient } from "~/lib/posthog";

export function PostHogProvider({ children }: { children: ReactNode }) {
  const client = useRef<ReturnType<typeof getPostHogClient> | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (client.current) {
      return;
    }

    try {
      client.current = getPostHogClient();
      setIsReady(true);
    } catch {
      // Environment may not be ready yet; avoid crashing the app.
      // PostHog will remain disabled until a successful initialization.
    }
  }, []);

  if (!isReady || !client.current) {
    return <Fragment>{children}</Fragment>;
  }
  return <RNPostHogProvider client={client.current}>{children}</RNPostHogProvider>;
}
