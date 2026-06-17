"use client";

import { useEffect } from "react";
import { MaintenancePage } from "~/components/maintenance-page";

import "./globals.css";

/**
 * Top-level error boundary and last-resort safety net. Catches errors that
 * escape the segment-level `error.tsx` boundaries, including failures in the
 * root layout. It must render its own <html>/<body> as it replaces the root
 * layout. (Errors thrown in `generateMetadata` are not caught by any boundary —
 * those are handled at the source via `safeMetadata`.)
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="h-full">
        <MaintenancePage />
      </body>
    </html>
  );
}
