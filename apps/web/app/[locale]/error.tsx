"use client";

import { useEffect } from "react";
import { MaintenancePage } from "~/components/maintenance-page";

export default function LocaleError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("Public page failed to render:", error);
  }, [error]);

  return <MaintenancePage />;
}
