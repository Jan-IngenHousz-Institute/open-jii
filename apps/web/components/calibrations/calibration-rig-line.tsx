"use client";

import { useLocale } from "@/hooks/useLocale";
import { X } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import type { BenchInstrumentSummary } from "@repo/iot";
import { cn } from "@repo/ui/lib/utils";

import { formatList } from "./format-list";
import { formatRange } from "./format-range";
import { InlineChoice } from "./inline-choice";
import { InlineToken } from "./inline-token";
import type { AuxiliaryInstrument } from "./procedure-edits";
import { ROLE_PATTERN } from "./procedure-edits";
import type { SetpointOption } from "./rig-sources";

const ANY_INSTRUMENT = "any";

interface CalibrationRigLineProps {
  instrument: AuxiliaryInstrument;
  instruments: BenchInstrumentSummary[];
  /** Every role the rig holds, this one included, so a rename cannot collide. */
  takenRoles: string[];
  /** Steps naming this role; it cannot be removed while any do. */
  usedBySteps: number;
  setpoints: SetpointOption[];
  readings: string[];
  canEdit: boolean;
  onChange: (next: AuxiliaryInstrument) => void;
  onRename: (role: string) => void;
  onRemove: () => void;
}

/** One piece of bench equipment, as the line a step will address it by. */
export function CalibrationRigLine({
  instrument,
  instruments,
  takenRoles,
  usedBySteps,
  setpoints,
  readings,
  canEdit,
  onChange,
  onRename,
  onRemove,
}: CalibrationRigLineProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const model = instruments.find((candidate) => candidate.model === instrument.model);
  // takenRoles carries every role including this one's own, once each; a rename that
  // collides shows up as this role appearing twice, not as it "still" being in the list.
  const isTaken = takenRoles.filter((role) => role === instrument.role).length > 1;
  const roleError = isTaken
    ? t("iot.calibration.rig.roleTaken")
    : ROLE_PATTERN.test(instrument.role)
      ? undefined
      : t("iot.calibration.rig.roleInvalid");

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

  return (
    <li className="group col-span-3 grid grid-cols-subgrid items-baseline py-1 text-[15px] leading-7">
      <InlineToken
        value={instrument.role}
        label={t("iot.calibration.rig.role")}
        canEdit={canEdit}
        mono
        invalid={roleError}
        onCommit={onRename}
        className="font-mono"
      />

      <p className="min-w-0">
        <InlineChoice
          value={instrument.model ?? ANY_INSTRUMENT}
          label={t("iot.calibration.rig.instrument")}
          options={[
            ...instruments.map((candidate) => ({ value: candidate.model })),
            { value: ANY_INSTRUMENT, label: t("iot.calibration.rig.anyInstrument") },
          ]}
          canEdit={canEdit}
          onCommit={handleModelChange}
        />

        <span className="text-muted-foreground"> {t("iot.calibration.rig.answeringTo")} </span>

        <InlineToken
          value={instrument.handshake}
          label={t("iot.calibration.rig.handshake")}
          canEdit={canEdit}
          mono
          placeholder={t("iot.calibration.rig.anyHandshake")}
          invalid={
            instrument.handshake.trim() === ""
              ? t("iot.calibration.rig.handshakeRequired")
              : undefined
          }
          onCommit={(handshake) => onChange({ ...instrument, handshake })}
        />

        {/* Read as one clause continuing the sentence above, not a second, comma-spliced
            fact bolted on with a middot: "…, and drives X and Y." */}
        {setpoints.length > 0 && (
          <span className="text-muted-foreground text-sm">
            {", "}
            {t("iot.calibration.rig.drives")}{" "}
            <span className="font-mono">{formatList(locale, setpoints.map(formatRange))}</span>
          </span>
        )}

        {readings.length > 0 && (
          <span className="text-muted-foreground text-sm">
            {setpoints.length > 0 ? ` ${t("iot.calibration.produces.and")} ` : ", "}
            {t("iot.calibration.rig.answers")}{" "}
            <span className="font-mono">{formatList(locale, readings)}</span>
          </span>
        )}
      </p>

      {canEdit && (
        <span className="flex h-7 items-center self-start">
          <button
            type="button"
            onClick={onRemove}
            disabled={usedBySteps > 0}
            aria-label={t("iot.calibration.rig.remove", { role: instrument.role })}
            className={cn(
              "text-muted-foreground/0 group-hover:text-muted-foreground/70 hover:text-destructive! transition-colors",
              usedBySteps > 0 && "hidden",
            )}
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      )}
    </li>
  );
}
