"use client";

import { useEffect } from "react";
import { StatusFrame } from "~/components/status-frame";
import { StatusUnavailable } from "~/components/status-unavailable";

const RETRY_MS = 60_000;

// The unavailable card promises a retry every minute; a crashed page has to keep that promise too.
export default function ErrorPage({ reset }: { reset: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(reset, RETRY_MS);

    return () => window.clearTimeout(timer);
  }, [reset]);

  return (
    <StatusFrame>
      <StatusUnavailable />
    </StatusFrame>
  );
}
