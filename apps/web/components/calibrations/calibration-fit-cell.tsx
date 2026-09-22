"use client";

import type {
  CalibrationFamily,
  CalibrationOutputSchema,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";

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

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <CalibrationScriptEditor script={script} canEdit={canEdit} onChange={onScriptChange} />
        {canEdit && (
          <CalibrationFitDraftAction
            series={series}
            outputSchema={outputSchema}
            onDraft={onScriptChange}
          />
        )}
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">{t("iot.calibration.fit.submits")}</p>
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
