"use client";

import { Wand2 } from "lucide-react";
import { useState } from "react";

import type { CalibrationOutputSchema } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";

import { fitRecipe } from "./fit-recipe";
import type { ProducedSeries } from "./produced-series";

interface CalibrationFitDraftActionProps {
  series: ProducedSeries[];
  outputSchema: CalibrationOutputSchema;
  onDraft: (script: string) => void;
}

/**
 * Writes the fit the capture and the blocks already describe.
 *
 * It replaces the script outright and the page autosaves, so it asks first: what it
 * produces is a starting point, not a merge into whatever is there.
 */
export function CalibrationFitDraftAction({
  series,
  outputSchema,
  onDraft,
}: CalibrationFitDraftActionProps) {
  const { t } = useTranslation("iot");
  const [isOpen, setIsOpen] = useState(false);

  function handleDraft() {
    onDraft(fitRecipe(series, outputSchema));
    setIsOpen(false);
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Wand2 className="mr-2 size-4" aria-hidden />
          {t("iot.calibration.fit.draft")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("iot.calibration.fit.draftTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("iot.calibration.fit.draftConfirm")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("iot.calibration.fit.draftCancel")}</AlertDialogCancel>
          <Button onClick={handleDraft}>{t("iot.calibration.fit.draftReplace")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
