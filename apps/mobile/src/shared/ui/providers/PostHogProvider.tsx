import { PostHogProvider as RNPostHogProvider } from "posthog-react-native";
import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createLogger } from "~/shared/observability/logger";
import { getPostHogClient } from "~/shared/observability/posthog";
import { useEnvironmentStore } from "~/shared/stores/environment-store";

const log = createLogger("posthog-provider");

export function PostHogProvider({ children }: { children: ReactNode }) {
  const client = useRef<ReturnType<typeof getPostHogClient> | null>(null);
  const [isReady, setIsReady] = useState(false);
  // getPostHogClient reads the env store, which throws until AsyncStorage
  // rehydration completes. Gating init on that flag makes a cold start retry
  // instead of disabling analytics for the whole session.
  const envLoaded = useEnvironmentStore((s) => s.isLoaded);

  useEffect(() => {
    if (!envLoaded || client.current) {
      return;
    }

    try {
      client.current = getPostHogClient();
      setIsReady(true);
    } catch (err) {
      // A misconfigured build must not crash the app, but a failed init must
      // be loud: the previous silent catch hid weeks of missing telemetry.
      log.error("posthog init failed", { err: (err as Error)?.message });
    }
  }, [envLoaded]);

  // Offline gating lives in getPostHogClient (its fetch is connectivity-gated),
  // so nothing to wire here.

  if (!isReady || !client.current) {
    return <Fragment>{children}</Fragment>;
  }
  return <RNPostHogProvider client={client.current}>{children}</RNPostHogProvider>;
}
