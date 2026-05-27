"use client";

import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Switch } from "@repo/ui/components/switch";
import { toast } from "@repo/ui/hooks/use-toast";

import { useExperimentUpdate } from "../../hooks/experiment/useExperimentUpdate/useExperimentUpdate";

interface ExperimentAnonymizeToggleProps {
  experimentId: string;
  initialAnonymize: boolean;
  isArchived?: boolean;
}

/**
 * Anonymization toggle. When on, the API pseudonymises CONTRIBUTOR cells
 * before responding, so every chart and the data table show stable
 * `Contributor-XXXXXX` labels instead of real names.
 */
export function ExperimentAnonymizeToggle({
  experimentId,
  initialAnonymize,
  isArchived = false,
}: ExperimentAnonymizeToggleProps) {
  const { t } = useTranslation();
  const { mutate: updateExperiment, isPending } = useExperimentUpdate();
  const [enabled, setEnabled] = useState(initialAnonymize);

  const handleChange = (next: boolean) => {
    setEnabled(next);
    updateExperiment(
      {
        params: { id: experimentId },
        body: { anonymizeContributors: next },
      },
      {
        onSuccess: () => toast({ description: t("experiments.experimentUpdated") }),
        onError: () => {
          setEnabled(!next);
          toast({
            description: t("experiments.experimentUpdateFailed"),
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">{t("experimentAnonymize.title")}</div>
        <p className="text-muted-foreground text-xs">{t("experimentAnonymize.description")}</p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={handleChange}
        disabled={isArchived || isPending}
        aria-label={t("experimentAnonymize.title")}
      />
    </div>
  );
}
