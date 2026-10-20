"use client";

import { ExperimentLocationManagement } from "@/components/experiment-settings/experiment-location-management-card";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";

import { useTranslation } from "@repo/i18n";
import type { ButtonProps } from "@repo/ui/components/button";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";

interface AddLocationActionProps {
  experimentId: string;
  variant: ButtonProps["variant"];
}

/** Opens the same location manager as the details card's Experiment Locations section. */
export function AddLocationAction({ experimentId, variant }: AddLocationActionProps) {
  const { t } = useTranslation("readinessConceptA");
  const { t: tExperiments } = useTranslation("experiments");
  const { data: access } = useExperimentAccess(experimentId);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>
          {t("action.add-location")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tExperiments("settings.locations.title")}</DialogTitle>
          <DialogDescription>{tExperiments("settings.locations.description")}</DialogDescription>
        </DialogHeader>
        <ExperimentLocationManagement experimentId={experimentId} hasAccess={access?.isAdmin} />
      </DialogContent>
    </Dialog>
  );
}
