"use client";

import { useExperimentUpdate } from "@/hooks/experiment/useExperimentUpdate/useExperimentUpdate";
import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

import { InlineEditableTitle } from "../shared/inline-editable-title";

interface ExperimentTitleProps {
  experimentId: string;
  name: string;
  status: string;
  visibility: string;
  hasAccess?: boolean;
  isArchived?: boolean;
}

export function ExperimentTitle({
  experimentId,
  name,
  hasAccess = false,
  isArchived = false,
}: ExperimentTitleProps) {
  const { t } = useTranslation("experiments");
  const { mutateAsync: updateExperiment, isPending: isUpdating } = useExperimentUpdate();

  const handleSave = async (newName: string) => {
    await updateExperiment(
      {
        id: experimentId,
        name: newName,
      },
      {
        onSuccess: () => {
          toast({ description: t("experiments.experimentUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <InlineEditableTitle
      name={name}
      hasAccess={hasAccess && !isArchived}
      onSave={handleSave}
      isPending={isUpdating}
    />
  );
}
