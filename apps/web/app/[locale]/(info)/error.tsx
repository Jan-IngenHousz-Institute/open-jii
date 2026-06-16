"use client";

import { useEffect } from "react";
import { MaintenancePage } from "~/components/maintenance-page";

export default function InfoError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("Info page failed to render:", error);
  }, [error]);

  return <MaintenancePage />;
}
