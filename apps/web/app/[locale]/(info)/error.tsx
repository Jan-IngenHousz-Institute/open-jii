"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { MaintenancePage } from "~/components/maintenance-page";

export default function InfoError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("Info page failed to render:", error);
    posthog.captureException(error, { boundary: "info", digest: error.digest });
  }, [error]);

  return <MaintenancePage />;
}
