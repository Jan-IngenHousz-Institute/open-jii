"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

import type {
  CalibrationFamily,
  CalibrationOutputSchema,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { cn } from "@repo/ui/lib/utils";

import { CalibrationFitDraftAction } from "./calibration-fit-draft-action";
import { CalibrationOutputSchemaEditor } from "./calibration-output-schema-editor";
import { CalibrationScriptEditor } from "./calibration-script-editor";
import type { ProducedSeries } from "./produced-series";

interface CalibrationFitCellProps {
  script: string;
  outputSchema: CalibrationOutputSchema;
  /** What the capture hands this script, which is what a drafted fit reads from. */
  series: ProducedSeries[];
  family: CalibrationFamily;
  canEdit: boolean;
  onScriptChange: (script: string) => void;
  onSchemaChange: (schema: CalibrationOutputSchema) => void;
}

/** The blocks are the script's contract: a name here is what `submit()` must use. */
export function CalibrationFitCell({
  script,
  outputSchema,
  series,
  family,
  canEdit,
  onScriptChange,
  onSchemaChange,
}: CalibrationFitCellProps) {
  const { t } = useTranslation("iot");
  const lines = script.split("\n").length;
  // Reading is about the shape a calibration has, not the Python that produces it: open
  // while there is work to do on the script, closed once it is only there to be trusted.
  const [isOpen, setIsOpen] = useState(canEdit);

  return (
    <div className="space-y-5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between gap-3">
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group/trigger flex items-center gap-1.5 text-sm">
            <ChevronRight
              className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
              aria-hidden
            />
            {t("iot.calibration.fit.scriptLines", { count: lines })}
          </CollapsibleTrigger>

          {canEdit && (
            <CalibrationFitDraftAction
              series={series}
              outputSchema={outputSchema}
              onDraft={onScriptChange}
            />
          )}
        </div>

        <CollapsibleContent className="pt-2">
          <CalibrationScriptEditor script={script} canEdit={canEdit} onChange={onScriptChange} />
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t("iot.calibration.fit.submits")}</h3>
        <CalibrationOutputSchemaEditor
          family={family}
          outputSchema={outputSchema}
          canEdit={canEdit}
          onChange={onSchemaChange}
        />
      </div>
    </div>
  );
}
