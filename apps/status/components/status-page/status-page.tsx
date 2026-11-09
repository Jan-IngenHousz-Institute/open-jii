"use client";

import { useStatusDocument } from "~/hooks/use-status-document";

import { StatusContent } from "./status-content";
import { StatusFrame } from "./status-frame";
import { StatusSkeleton } from "./status-skeleton";
import { StatusUnavailable } from "./status-unavailable";

export function StatusPage() {
  const { document, serverOffsetMs, hasFailed } = useStatusDocument();

  function renderBody() {
    if (document !== undefined) {
      return (
        <StatusContent
          document={document}
          serverOffsetMs={serverOffsetMs}
          hasRefreshFailed={hasFailed}
        />
      );
    }

    return hasFailed ? <StatusUnavailable /> : <StatusSkeleton />;
  }

  return <StatusFrame>{renderBody()}</StatusFrame>;
}
