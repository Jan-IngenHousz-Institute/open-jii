import { PostHogProvider as RNPostHogProvider } from "posthog-react-native";
import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getPostHogClient } from "~/shared/observability/posthog";

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

  // Offline gating lives in getPostHogClient (its fetch is connectivity-gated),
  // so nothing to wire here.

  if (!isReady || !client.current) {
    return <Fragment>{children}</Fragment>;
  }
  return <RNPostHogProvider client={client.current}>{children}</RNPostHogProvider>;
}
