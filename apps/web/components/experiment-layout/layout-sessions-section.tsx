"use client";

import { useSearchParams } from "next/navigation";

import { FieldSessionsPanel } from "./sessions/field-sessions-panel";
import { SESSIONS_VIEWS } from "./sessions/sessions-view";

interface LayoutSessionsSectionProps {
  experimentId: string;
  canEdit: boolean;
}

/** Scaffold: the `sessions` search parameter picks which state of the section is shown. */
export function LayoutSessionsSection({ experimentId, canEdit }: LayoutSessionsSectionProps) {
  const requested = useSearchParams().get("sessions");
  const view = SESSIONS_VIEWS.find((candidate) => candidate === requested);

  if (!view) {
    return null;
  }

  return <FieldSessionsPanel experimentId={experimentId} canEdit={canEdit} view={view} />;
}
