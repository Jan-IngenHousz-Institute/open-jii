"use client";

import { useAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { calibrationDefinitionsQuery } from "@/hooks/iot/useAllCalibrationDefinitions/calibration-definitions-query";
import { useCreateCalibrationDefinition } from "@/hooks/iot/useCreateCalibrationDefinition/useCreateCalibrationDefinition";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseApiError } from "~/util/apiError";

import type { CalibrationDefinitionDetail } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

import { copyOfName } from "./starter-definition";

interface CalibrationDuplicateActionProps {
  definition: CalibrationDefinitionDetail;
}

/**
 * The route to a definition of one's own: a run freezes the one it recorded, and someone
 * else's can be read but not changed. The copy lands in the caller's own organization.
 */
export function CalibrationDuplicateAction({ definition }: CalibrationDuplicateActionProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const router = useRouter();

  const queryClient = useQueryClient();
  const autosave = useAutosaveStatus();
  // The copy is made from what is saved, so an edit still waiting on autosave would be left out.
  const isSaving = autosave?.status === "dirty" || autosave?.status === "saving";
  const { mutate: create, isPending } = useCreateCalibrationDefinition({
    onSuccess: (created) => {
      router.push(`/${locale}/platform/calibrations/${created.id}`);
    },
  });

  async function handleDuplicate() {
    // Fetched on demand: the names in use matter for the copy's name and nothing else here.
    let taken: string[];
    try {
      const definitions = await queryClient.fetchQuery(calibrationDefinitionsQuery(orpc));
      taken = definitions.map((candidate) => candidate.name);
    } catch (error) {
      toast({ description: parseApiError(error)?.message, variant: "destructive" });
      return;
    }

    create(
      {
        family: definition.family,
        name: copyOfName(definition.name, taken),
        captureProcedure: definition.captureProcedure,
        script: definition.script,
        outputSchema: definition.outputSchema,
        ...(definition.description === null ? {} : { description: definition.description }),
        ...(definition.minFirmwareVersion === null
          ? {}
          : { minFirmwareVersion: definition.minFirmwareVersion }),
      },
      {
        onError: (error) => {
          toast({ description: parseApiError(error)?.message, variant: "destructive" });
        },
      },
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void handleDuplicate()}
      disabled={isPending || isSaving}
    >
      <Copy className="mr-2 h-4 w-4" />
      {t("iot.calibration.detail.duplicate")}
    </Button>
  );
}
