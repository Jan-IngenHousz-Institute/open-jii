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
import { setpointTargets } from "./rig-sources";

interface CalibrationRigStripProps {
  procedure: CaptureProcedure;
  family: CalibrationFamily;
  canEdit: boolean;
  onChange: (procedure: CaptureProcedure) => void;
}

/**
 * The bench this procedure expects, as one line above the document it runs.
 *
 * A rig is not a sequence of things to do, it is the context the steps are written
 * against: the roles they may name, the setpoints they may drive, the readings they may
 * ask for. It belongs where a workbook keeps the family it is written for, not as a card
 * in the flow.
 */
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
  const deviceSetpoints = setpointTargets(procedure, family).find(
    (target) => target.role === DUT_ROLE,
  );

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
    return (
      <DropdownMenuItem
        key={instrument.model}
        className="font-mono"
        onSelect={() => handleAdd(instrument)}
      >
        {instrument.model}
      </DropdownMenuItem>
    );
  }

  function renderInstrument(instrument: AuxiliaryInstrument, index: number) {
    const model = instruments.find((candidate) => candidate.model === instrument.model);
    const answers = [
      ...(model?.setpoints
        .map((setpoint) => setpoint.name)
        .slice(0, 2)
        .map((name) => `${name}→`) ?? []),
      ...(model?.readings.map((reading) => reading.name).slice(0, 2) ?? []),
    ].join(" ");

    return (
      <Popover key={index}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="bg-card hover:border-primary/40 flex items-center gap-2 rounded-lg border px-3 py-2 text-left"
          >
            <Settings2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="block font-mono text-sm">{instrument.role}</span>
              <span className="text-muted-foreground block font-mono text-[11px]">
                {answers === "" ? (instrument.model ?? instrument.handshake) : answers}
              </span>
            </span>
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

  return (
    <div className="flex flex-wrap items-stretch gap-2">
      <div className="bg-muted/40 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2">
        <Cpu className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="min-w-0">
          <span className="block font-mono text-sm">{DUT_ROLE}</span>
          <span className="text-muted-foreground block font-mono text-[11px]">
            {deviceSetpoints === undefined
              ? t("iot.calibration.rig.noDeviceSetpoints")
              : deviceSetpoints.setpoints.map((setpoint) => `${setpoint.name}→`).join(" ")}
          </span>
        </span>
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
