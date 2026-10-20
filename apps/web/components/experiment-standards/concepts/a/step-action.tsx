"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import type { ReadinessAction } from "../readiness-steps";
import { AddLocationAction } from "./add-location-action";
import { OrcidReminderAction } from "./orcid-reminder-action";

type LinkedAction = Exclude<ReadinessAction, "add-location" | "connect-orcid">;

interface StepActionProps {
  experimentId: string;
  action: ReadinessAction;
  /** The first step carries the primary button, so the next thing to do stands out. */
  isNext: boolean;
}

/** The one button that takes a step to the screen that fixes it. */
export function StepAction({ experimentId, action, isNext }: StepActionProps) {
  const { t } = useTranslation("readinessConceptA");
  const locale = useLocale();
  const variant = isNext ? "default" : "outline";

  if (action === "add-location") {
    return <AddLocationAction experimentId={experimentId} variant={variant} />;
  }
  if (action === "connect-orcid") {
    return <OrcidReminderAction variant={variant} />;
  }

  const experimentPath = `/${locale}/platform/experiments/${experimentId}`;
  const paths: Record<LinkedAction, string> = {
    "describe-columns": `${experimentPath}/data`,
    "add-terms": `${experimentPath}/data`,
    "open-layout": `${experimentPath}/layout`,
    "publish-dataset": `${experimentPath}/datasets`,
  };

  return (
    <Button asChild size="sm" variant={variant}>
      <IntentLink href={paths[action]}>{t(`action.${action}`)}</IntentLink>
    </Button>
  );
}
