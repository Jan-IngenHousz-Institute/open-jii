"use client";

import { Plus } from "lucide-react";

import type {
  ProcedureRead,
  ProcedureStep,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { DUT_ROLE } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { CalibrationReadRow } from "./calibration-read-row";
import { uniqueName } from "./output-schema-edits";
import { addRead, removeRead, replaceRead, stepReads } from "./procedure-edits";
import type { ReadSource } from "./rig-sources";

/** What a column is called before the author names it. */
const NEW_COLUMN = "value";

/** Every family's driver answers this, and a rig always declares the device. */
const FALLBACK_COMMAND = "hello";

interface CalibrationReadListProps {
  step: ProcedureStep;
  sources: ReadSource[];
  canEdit: boolean;
  onChange: (step: ProcedureStep) => void;
}

/** What a step records at each of its points, one column per reading. */
export function CalibrationReadList({
  step,
  sources,
  canEdit,
  onChange,
}: CalibrationReadListProps) {
  const { t } = useTranslation("iot");

  const reads = stepReads(step);
  const columns = reads.map((read) => read.as);

  function handleAdd() {
    const first = sources.at(0);
    const read: ProcedureRead = {
      instrument: first?.role ?? DUT_ROLE,
      command: first?.offered.at(0) ?? FALLBACK_COMMAND,
      as: uniqueName(NEW_COLUMN, columns),
    };

    onChange(addRead(step, read));
  }

  function renderRead(read: ProcedureRead, index: number) {
    return (
      <CalibrationReadRow
        // Positional, so renaming a column does not remount its row mid-keystroke.
        key={index}
        read={read}
        sources={sources}
        takenColumns={columns}
        canEdit={canEdit}
        canRemove={reads.length > 1}
        onChange={(next) => onChange(replaceRead(step, index, next))}
        onRemove={() => onChange(removeRead(step, index))}
      />
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {t("iot.calibration.procedure.records")}
      </p>

      <ul className="space-y-2">{reads.map(renderRead)}</ul>

      {canEdit && (
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="mr-2 size-4" aria-hidden />
          {t("iot.calibration.procedure.addRead")}
        </Button>
      )}
    </div>
  );
}
