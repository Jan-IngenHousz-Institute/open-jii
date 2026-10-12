"use client";

import { useEffect } from "react";
import { MaintenancePage } from "~/components/maintenance-page";
import { loadPostHog } from "~/lib/posthog-client";

export default function InfoError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("Info page failed to render:", error);
    void loadPostHog().then((posthog) =>
      posthog.captureException(error, { boundary: "info", digest: error.digest }),
    );
  }, [error]);

  return <MaintenancePage />;
}
