"use client";

import { useAllCalibrationDefinitions } from "@/hooks/iot/useAllCalibrationDefinitions/useAllCalibrationDefinitions";
import { useCreateCalibrationDefinition } from "@/hooks/iot/useCreateCalibrationDefinition/useCreateCalibrationDefinition";
import { useLocale } from "@/hooks/useLocale";
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

/** A run freezes its definition, so duplicating is the only route to the next revision. */
export function CalibrationDuplicateAction({ definition }: CalibrationDuplicateActionProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const router = useRouter();

  const definitions = useAllCalibrationDefinitions();
  const { mutate: create, isPending } = useCreateCalibrationDefinition({
    onSuccess: (created) => {
      router.push(`/${locale}/platform/calibrations/${created.id}`);
    },
  });

  function handleDuplicate() {
    const taken = (definitions.data ?? []).map((candidate) => candidate.name);

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
    <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={isPending}>
      <Copy className="mr-2 h-4 w-4" />
      {t("iot.calibration.detail.duplicate")}
    </Button>
  );
}
