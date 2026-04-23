"use client";

import { useExperimentUpdate } from "@/hooks/experiment/useExperimentUpdate/useExperimentUpdate";
import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

import { InlineEditableDescription } from "../shared/inline-editable-description";

interface ExperimentDescriptionProps {
  experimentId: string;
  description: string;
  hasAccess?: boolean;
  isArchived?: boolean;
}

export function ExperimentDescription({
  experimentId,
  description,
  hasAccess = false,
  isArchived = false,
}: ExperimentDescriptionProps) {
  const { t } = useTranslation("experiments");
  const { mutateAsync: updateExperiment, isPending: isUpdating } = useExperimentUpdate();

  const handleSave = async (newDescription: string) => {
    await updateExperiment(
      {
        params: { id: experimentId },
        body: { description: newDescription },
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
    <InlineEditableDescription
      description={description}
      hasAccess={hasAccess && !isArchived}
      onSave={handleSave}
      isPending={isUpdating}
      title={t("descriptionTitle")}
      saveLabel={t("common.save")}
      cancelLabel={t("common.cancel")}
      placeholder={t("form.descriptionPlaceholder")}
    />
  );
}
