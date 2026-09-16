"use client";

import { Plus } from "lucide-react";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import {
  DUT_ROLE,
  MAX_RIG_INSTRUMENTS,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import type { BenchInstrumentSummary } from "@repo/iot";
import { benchInstrumentSummaries, familyCalibrationCapabilities, isSensorFamily } from "@repo/iot";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

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

interface CalibrationRigEditorProps {
  procedure: CaptureProcedure;
  family: CalibrationFamily;
  canEdit: boolean;
  onChange: (procedure: CaptureProcedure) => void;
}

/**
 * The bench a procedure needs: the device being calibrated, and the equipment around it.
 *
 * Every name here is one the steps point at, so nothing is typed that the platform
 * already knows. The instruments come from the driver registry, and each row says what
 * the one it names can be driven through and read for.
 */
export function CalibrationRigEditor({
  procedure,
  family,
  canEdit,
  onChange,
}: CalibrationRigEditorProps) {
  const { t } = useTranslation("iot");

  const instruments = benchInstrumentSummaries();
  const auxiliary = procedure.instruments.filter(isAuxiliaryInstrument);
  const takenRoles = procedure.instruments.map((instrument) => instrument.role);
  const usage = instrumentRoleUsage(procedure);
  const hasRoomForMore = procedure.instruments.length < MAX_RIG_INSTRUMENTS;

  const deviceSetpoints = isSensorFamily(family)
    ? familyCalibrationCapabilities(family).deviceSetpoints
    : [];

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

  // Keyed by position, not by role: a role keyed row would remount on every keystroke of
  // a rename and take the focus with it.
  function renderRow(instrument: AuxiliaryInstrument, index: number) {
    return (
      <CalibrationRigRow
        key={index}
        instrument={instrument}
        instruments={instruments}
        takenRoles={takenRoles}
        usedBySteps={usage[instrument.role] ?? 0}
        canEdit={canEdit}
        onChange={(next) => onChange(replaceInstrument(procedure, instrument.role, next))}
        onRename={(role) => onChange(renameInstrumentRole(procedure, instrument.role, role))}
        onRemove={() => onChange(removeInstrument(procedure, instrument.role))}
      />
    );
  }

  function renderDeviceSetpoints() {
    if (deviceSetpoints.length === 0) {
      return t("iot.calibration.rig.noDeviceSetpoints");
    }

    return deviceSetpoints
      .map(
        (setpoint) =>
          `${setpoint.name} (${String(setpoint.min)}…${String(setpoint.max)} ${setpoint.unit})`,
      )
      .join(", ");
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{t("iot.calibration.rig.hint")}</p>

      <ul className="space-y-2">
        <li className="space-y-1 rounded-md border border-dashed p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm">{DUT_ROLE}</span>
            <span className="text-muted-foreground text-xs">{t("iot.calibration.rig.dut")}</span>
          </div>
          <p className="text-muted-foreground text-xs">
            {t("iot.calibration.rig.setpoints")}{" "}
            <span className="font-mono">{renderDeviceSetpoints()}</span>
          </p>
        </li>

        {auxiliary.map(renderRow)}
      </ul>

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={!hasRoomForMore}>
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
