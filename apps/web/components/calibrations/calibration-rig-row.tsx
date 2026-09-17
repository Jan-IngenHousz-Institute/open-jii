"use client";

import { Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { useTranslation } from "@repo/i18n";
import type { BenchInstrumentSummary } from "@repo/iot";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { AuxiliaryInstrument } from "./procedure-edits";
import { ROLE_PATTERN } from "./procedure-edits";

/** Stands for a handshake that names a unit rather than a model, and for older rigs. */
const ANY_INSTRUMENT = "any";

interface CalibrationRigRowProps {
  instrument: AuxiliaryInstrument;
  instruments: BenchInstrumentSummary[];
  /** Every role the rig holds, this one included, so a rename cannot collide. */
  takenRoles: string[];
  /** Steps naming this role; it cannot be removed while any do. */
  usedBySteps: number;
  canEdit: boolean;
  onChange: (next: AuxiliaryInstrument) => void;
  onRename: (role: string) => void;
  onRemove: () => void;
}

/**
 * One piece of bench equipment: what the steps call it, what it is, and what it answers.
 *
 * The model is picked rather than typed, because the setpoints and readings a step may
 * name come from it, and because a handshake naming one unit of a model ("Par_REF") tells
 * the platform nothing about which model that is.
 */
export function CalibrationRigRow({
  instrument,
  instruments,
  takenRoles,
  usedBySteps,
  canEdit,
  onChange,
  onRename,
  onRemove,
}: CalibrationRigRowProps) {
  const { t } = useTranslation("iot");
  const roleId = useId();
  const modelId = useId();
  const handshakeId = useId();

  // A role is committed only once it is a name the steps can carry, so a rename passing
  // through another role's name cannot take that role's steps with it.
  const [draftRole, setDraftRole] = useState(instrument.role);
  const [committedRole, setCommittedRole] = useState(instrument.role);

  // Rows are positional, so a removal above this one hands it a different instrument.
  if (instrument.role !== committedRole) {
    setCommittedRole(instrument.role);
    setDraftRole(instrument.role);
  }

  const isTaken = draftRole !== instrument.role && takenRoles.includes(draftRole);
  const isMalformed = !ROLE_PATTERN.test(draftRole);
  const roleError = isTaken
    ? t("iot.calibration.rig.roleTaken")
    : isMalformed
      ? t("iot.calibration.rig.roleInvalid")
      : null;

  const model = instruments.find((candidate) => candidate.model === instrument.model);
  const isRemovable = usedBySteps === 0;
  // Nothing can be bound to a role with no handshake, so the page will not save one.
  const hasNoHandshake = instrument.handshake.trim() === "";

  function handleRoleChange(value: string) {
    setDraftRole(value);
    if (value !== instrument.role && ROLE_PATTERN.test(value) && !takenRoles.includes(value)) {
      onRename(value);
    }
  }

  function handleRoleBlur() {
    if (roleError !== null) {
      setDraftRole(instrument.role);
    }
  }

  function handleModelChange(value: string) {
    if (value === ANY_INSTRUMENT) {
      onChange({ role: instrument.role, handshake: instrument.handshake });
      return;
    }

    const picked = instruments.find((candidate) => candidate.model === value);
    // A handshake the author typed to tell two units apart is theirs to keep; one that
    // only ever named the old model is replaced along with it.
    const keepsHandshake =
      instrument.handshake.trim() !== "" && instrument.handshake !== model?.identityToken;

    onChange({
      ...instrument,
      model: value,
      handshake: keepsHandshake ? instrument.handshake : (picked?.identityToken ?? ""),
    });
  }

  function renderModelOption(candidate: BenchInstrumentSummary) {
    return (
      <SelectItem key={candidate.model} value={candidate.model} className="font-mono">
        {candidate.model}
      </SelectItem>
    );
  }

  function renderCapabilities() {
    if (model === undefined) {
      return (
        <p className="text-muted-foreground text-xs">
          {t("iot.calibration.rig.anyInstrumentHint")}
        </p>
      );
    }

    const setpoints = model.setpoints.map(
      (setpoint) =>
        `${setpoint.name} (${String(setpoint.min)}…${String(setpoint.max)} ${setpoint.unit})`,
    );
    const readings = model.readings.map((reading) => `${reading.name} (${reading.unit})`);

    return (
      <dl className="text-muted-foreground grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt>{t("iot.calibration.rig.setpoints")}</dt>
        <dd className="font-mono">
          {setpoints.length > 0 ? setpoints.join(", ") : t("iot.calibration.rig.none")}
        </dd>
        <dt>{t("iot.calibration.rig.readings")}</dt>
        <dd className="font-mono">
          {readings.length > 0 ? readings.join(", ") : t("iot.calibration.rig.none")}
        </dd>
      </dl>
    );
  }

  return (
    <li className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-32 flex-1 space-y-1">
          <Label htmlFor={roleId} className="text-xs">
            {t("iot.calibration.rig.role")}
          </Label>
          <Input
            id={roleId}
            value={draftRole}
            onChange={(event) => handleRoleChange(event.target.value)}
            onBlur={handleRoleBlur}
            disabled={!canEdit}
            aria-invalid={roleError !== null}
            className="font-mono"
          />
        </div>

        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor={modelId} className="text-xs">
            {t("iot.calibration.rig.instrument")}
          </Label>
          <Select
            value={instrument.model ?? ANY_INSTRUMENT}
            onValueChange={handleModelChange}
            disabled={!canEdit}
          >
            <SelectTrigger id={modelId} className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {instruments.map(renderModelOption)}
              <SelectItem value={ANY_INSTRUMENT}>
                {t("iot.calibration.rig.anyInstrument")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-32 flex-1 space-y-1">
          <Label htmlFor={handshakeId} className="text-xs">
            {t("iot.calibration.rig.handshake")}
          </Label>
          <Input
            id={handshakeId}
            value={instrument.handshake}
            onChange={(event) => onChange({ ...instrument, handshake: event.target.value })}
            disabled={!canEdit}
            aria-invalid={hasNoHandshake}
            className="font-mono"
          />
        </div>

        {canEdit && (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              disabled={!isRemovable}
              aria-label={t("iot.calibration.rig.remove", { role: instrument.role })}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>

      {roleError !== null && <p className="text-destructive text-xs">{roleError}</p>}
      {hasNoHandshake && (
        <p className="text-destructive text-xs">{t("iot.calibration.rig.handshakeRequired")}</p>
      )}
      {!isRemovable && (
        <p className="text-muted-foreground text-xs">
          {t("iot.calibration.rig.usedBy", { count: usedBySteps })}
        </p>
      )}
      {renderCapabilities()}
    </li>
  );
}
