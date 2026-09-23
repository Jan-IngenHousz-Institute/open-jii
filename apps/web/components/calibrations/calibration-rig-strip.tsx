"use client";

import { useLocale } from "@/hooks/useLocale";
import { Plus } from "lucide-react";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import {
  DUT_ROLE,
  MAX_RIG_INSTRUMENTS,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import type { BenchInstrumentSummary } from "@repo/iot";
import { benchInstrumentSummaries } from "@repo/iot";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { CalibrationRigLine } from "./calibration-rig-line";
import { formatList } from "./format-list";
import { formatRange } from "./format-range";
import type { AuxiliaryInstrument } from "./procedure-edits";
import {
  addInstrument,
  instrumentRoleUsage,
  isAuxiliaryInstrument,
  removeInstrument,
  renameInstrumentRole,
  replaceInstrument,
  uniqueRole,
} from "./procedure-edits";
import { setpointTargets } from "./rig-sources";

interface CalibrationRigStripProps {
  procedure: CaptureProcedure;
  family: CalibrationFamily;
  canEdit: boolean;
  onChange: (procedure: CaptureProcedure) => void;
}

/** The rig is the context the steps are written against, not a step in the flow. */
export function CalibrationRigStrip({
  procedure,
  family,
  canEdit,
  onChange,
}: CalibrationRigStripProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const instruments = benchInstrumentSummaries();
  const auxiliary = procedure.instruments.filter(isAuxiliaryInstrument);
  const takenRoles = procedure.instruments.map((instrument) => instrument.role);
  const usage = instrumentRoleUsage(procedure);
  const hasRoomForMore = procedure.instruments.length < MAX_RIG_INSTRUMENTS;
  const targets = setpointTargets(procedure, family);

  function setpointsFor(role: string) {
    return targets.find((target) => target.role === role)?.setpoints ?? [];
  }

  function handleAdd(instrument: BenchInstrumentSummary) {
    onChange(
      addInstrument(procedure, {
        role: uniqueRole(instrument.model.replace(/-/g, "_"), takenRoles),
        handshake: instrument.identityToken,
        model: instrument.model,
      }),
    );
  }

  function renderAddOption(instrument: BenchInstrumentSummary) {
    const offers = [
      ...instrument.setpoints.map((setpoint) => setpoint.name),
      ...instrument.readings.map((reading) => reading.name),
    ].join(" · ");

    return (
      <DropdownMenuItem
        key={instrument.model}
        className="flex-col items-start gap-0.5"
        onSelect={() => handleAdd(instrument)}
      >
        <span className="font-mono">{instrument.model}</span>
        <span className="text-muted-foreground font-mono text-[11px]">{offers}</span>
      </DropdownMenuItem>
    );
  }

  function renderInstrument(instrument: AuxiliaryInstrument, index: number) {
    const model = instruments.find((candidate) => candidate.model === instrument.model);

    return (
      <CalibrationRigLine
        // Positional, so renaming a role does not remount its line mid-keystroke.
        key={index}
        instrument={instrument}
        instruments={instruments}
        takenRoles={takenRoles}
        usedBySteps={usage[instrument.role] ?? 0}
        setpoints={setpointsFor(instrument.role)}
        readings={(model?.readings ?? []).map((reading) => reading.name)}
        canEdit={canEdit}
        onChange={(next) => onChange(replaceInstrument(procedure, instrument.role, next))}
        onRename={(role) => onChange(renameInstrumentRole(procedure, instrument.role, role))}
        onRemove={() => onChange(removeInstrument(procedure, instrument.role))}
      />
    );
  }

  const dutSetpoints = setpointsFor(DUT_ROLE);

  return (
    <div className="space-y-2">
      <ul className="grid grid-cols-[max-content_1fr_auto] gap-x-6">
        <li className="col-span-3 grid grid-cols-subgrid items-baseline py-1 text-[15px] leading-7">
          <span className="font-mono">{DUT_ROLE}</span>
          <p className="text-muted-foreground min-w-0">
            {t("iot.calibration.rig.dut")}
            {dutSetpoints.length > 0 && (
              <span className="text-sm">
                {", "}
                {t("iot.calibration.rig.drives")}{" "}
                <span className="font-mono">
                  {formatList(locale, dutSetpoints.map(formatRange))}
                </span>
              </span>
            )}
          </p>
        </li>

        {auxiliary.map(renderInstrument)}
      </ul>

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-2.5 h-7"
              disabled={!hasRoomForMore}
            >
              <Plus className="size-3.5" aria-hidden />
              {t("iot.calibration.rig.add")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {instruments.map(renderAddOption)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
