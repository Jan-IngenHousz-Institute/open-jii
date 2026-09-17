"use client";

import { CellWrapper } from "@/components/workbook/cell-wrapper";
import { Code } from "lucide-react";

import type {
  CalibrationFamily,
  CalibrationOutputSchema,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";

import { CalibrationOutputSchemaEditor } from "./calibration-output-schema-editor";
import { CalibrationScriptEditor } from "./calibration-script-editor";

interface CalibrationFitCellProps {
  script: string;
  outputSchema: CalibrationOutputSchema;
  family: CalibrationFamily;
  canEdit: boolean;
  onScriptChange: (script: string) => void;
  onSchemaChange: (schema: CalibrationOutputSchema) => void;
}

/**
 * The last cell of the document: the code the captured readings are handed to, and the
 * coefficients it has to submit.
 *
 * Those two belong together. The blocks are not a separate thing the definition declares,
 * they are this script's contract: a name here is what `submit()` must use, and whether
 * the platform has a console command for it decides whether the number ever reaches a
 * device.
 */
export function CalibrationFitCell({
  script,
  outputSchema,
  family,
  canEdit,
  onScriptChange,
  onSchemaChange,
}: CalibrationFitCellProps) {
  const { t } = useTranslation("iot");

  const blocks = Object.entries(outputSchema.blocks);
  const coefficients = blocks.reduce(
    (total, [, entries]) => total + Object.keys(entries).length,
    0,
  );

  return (
    <CellWrapper
      icon={<Code className="h-4 w-4" />}
      label={
        <span data-testid="fit-label">
          {t("iot.calibration.fit.label", { blocks: blocks.length, coefficients })}
        </span>
      }
      labelText={t("iot.calibration.detail.script")}
      accentColor="var(--node-analysis)"
      readOnly={!canEdit}
      className="border"
    >
      <div className="space-y-5 px-4 py-4">
        <CalibrationScriptEditor script={script} canEdit={canEdit} onChange={onScriptChange} />

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {t("iot.calibration.fit.submits")}
          </p>
          <CalibrationOutputSchemaEditor
            family={family}
            outputSchema={outputSchema}
            canEdit={canEdit}
            onChange={onSchemaChange}
          />
        </div>
      </div>
    </CellWrapper>
  );
}
