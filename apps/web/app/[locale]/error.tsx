"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { MaintenancePage } from "~/components/maintenance-page";

export default function LocaleError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("Public page failed to render:", error);
    posthog.captureException(error, { boundary: "locale", digest: error.digest });
  }, [error]);

  return <MaintenancePage />;
}
