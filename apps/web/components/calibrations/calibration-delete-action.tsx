"use client";

import { useAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { useDeleteCalibrationDefinition } from "@/hooks/iot/useDeleteCalibrationDefinition/useDeleteCalibrationDefinition";
import { useLocale } from "@/hooks/useLocale";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { CalibrationDefinitionDetail } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

import { CalibrationDeleteDialog } from "./calibration-delete-dialog";

interface CalibrationDeleteActionProps {
  definition: CalibrationDefinitionDetail;
}

/** Only offered while no run has recorded the definition; one that has is kept for its runs. */
export function CalibrationDeleteAction({ definition }: CalibrationDeleteActionProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const autosave = useAutosaveStatus();
  // An edit still waiting to save would land on the deleted definition, and the page flushes
  // it on the way out.
  const isSaving = autosave?.status === "dirty" || autosave?.status === "saving";

  const { mutate: deleteDefinition, isPending } = useDeleteCalibrationDefinition({
    onSuccess: () => {
      toast({ title: t("iot.calibration.detail.deleteSuccess") });
      router.push(`/${locale}/platform/calibrations`);
    },
  });

  function handleConfirm() {
    deleteDefinition(
      { definitionId: definition.id },
      {
        // A run recorded meanwhile makes the server refuse; the dialog closes on its reason.
        onError: (error) => {
          setIsConfirming(false);
          toast({ description: parseApiError(error)?.message, variant: "destructive" });
        },
      },
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={isSaving}
        onClick={() => setIsConfirming(true)}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {t("iot.calibration.detail.delete")}
      </Button>
      <CalibrationDeleteDialog
        open={isConfirming}
        onOpenChange={setIsConfirming}
        definitionName={definition.name}
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
