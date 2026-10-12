"use client";

import { useEffect } from "react";
import { MaintenancePage } from "~/components/maintenance-page";
import { loadPostHog } from "~/lib/posthog-client";

export default function LocaleError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("Public page failed to render:", error);
    void loadPostHog().then((posthog) =>
      posthog.captureException(error, { boundary: "locale", digest: error.digest }),
    );
  }, [error]);

  return <MaintenancePage />;
}
