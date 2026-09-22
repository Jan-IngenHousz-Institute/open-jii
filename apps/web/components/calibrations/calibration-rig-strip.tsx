"use client";

import { Cpu, Plus, Settings2 } from "lucide-react";

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
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";

import { CalibrationRigChip } from "./calibration-rig-chip";
import { CalibrationRigRow } from "./calibration-rig-row";
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
import type { SetpointOption } from "./rig-sources";
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

  const instruments = benchInstrumentSummaries();
  const auxiliary = procedure.instruments.filter(isAuxiliaryInstrument);
  const takenRoles = procedure.instruments.map((instrument) => instrument.role);
  const usage = instrumentRoleUsage(procedure);
  const hasRoomForMore = procedure.instruments.length < MAX_RIG_INSTRUMENTS;
  const targets = setpointTargets(procedure, family);

  function setpointsFor(role: string): SetpointOption[] {
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
      <Popover key={index}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="bg-card hover:border-primary/40 flex items-start gap-2 rounded-lg border px-3 py-2 text-left"
          >
            <Settings2 className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            <CalibrationRigChip
              role={instrument.role}
              model={instrument.model ?? instrument.handshake}
              setpoints={setpointsFor(instrument.role)}
              readings={(model?.readings ?? []).map((reading) => reading.name)}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[32rem]">
          <ul>
            <CalibrationRigRow
              instrument={instrument}
              instruments={instruments}
              takenRoles={takenRoles}
              usedBySteps={usage[instrument.role] ?? 0}
              canEdit={canEdit}
              onChange={(next) => onChange(replaceInstrument(procedure, instrument.role, next))}
              onRename={(role) => onChange(renameInstrumentRole(procedure, instrument.role, role))}
              onRemove={() => onChange(removeInstrument(procedure, instrument.role))}
            />
          </ul>
        </PopoverContent>
      </Popover>
    );
  }

  // A grid, not a wrapping row: the roles are peers, and card widths should not follow
  // whatever each instrument's setpoint names happen to be.
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="bg-muted/40 flex items-start gap-2 rounded-lg border border-dashed px-3 py-2">
        <Cpu className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
        <CalibrationRigChip
          role={DUT_ROLE}
          model={t("iot.calibration.rig.dut")}
          setpoints={setpointsFor(DUT_ROLE)}
          readings={[]}
          noSetpoints={t("iot.calibration.rig.drivesNothing")}
        />
      </div>

      {auxiliary.map(renderInstrument)}

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground h-auto border border-dashed px-3"
              disabled={!hasRoomForMore}
            >
              <Plus className="mr-2 size-4" aria-hidden />
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
