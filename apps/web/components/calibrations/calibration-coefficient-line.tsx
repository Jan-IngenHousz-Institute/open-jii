"use client";

import type { CoefficientSpec } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { MAX_COEFFICIENT_ARRAY_LENGTH } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";

import { CalibrationRowRemove } from "./calibration-row-remove";
import { InlineChoice } from "./inline-choice";
import { InlineToken } from "./inline-token";
import type { CoefficientType } from "./output-schema-edits";
import {
  COEFFICIENT_NAME_PATTERN,
  COEFFICIENT_TYPES,
  retypeCoefficient,
  withBound,
  withLength,
} from "./output-schema-edits";

interface CalibrationCoefficientLineProps {
  name: string;
  spec: CoefficientSpec;
  /** Whether the platform has a console command for this one, or only records it. */
  isWritable: boolean;
  /** Every coefficient in this block, this one included, so a rename cannot collide. */
  takenNames: string[];
  canEdit: boolean;
  onRename: (to: string) => void;
  onChange: (spec: CoefficientSpec) => void;
  onRemove: () => void;
}

/** Bounds are checked at review, the last point before a wrong coefficient reaches a device. */
export function CalibrationCoefficientLine({
  name,
  spec,
  isWritable,
  takenNames,
  canEdit,
  onRename,
  onChange,
  onRemove,
}: CalibrationCoefficientLineProps) {
  const { t } = useTranslation("iot");

  const isArray = spec.type !== "number";
  // takenNames carries every sibling including this one's own, once each; a rename that
  // collides shows up as the name appearing twice, not as it "still" being there.
  const isTaken = takenNames.filter((entry) => entry === name).length > 1;
  const nameError = isTaken
    ? t("iot.calibration.produces.nameTaken")
    : COEFFICIENT_NAME_PATTERN.test(name)
      ? undefined
      : t("iot.calibration.produces.nameInvalid");

  // A rename onto a sibling would merge the two, so it is refused before it commits.
  function validateName(to: string) {
    const isTaken = to !== name && takenNames.includes(to);
    if (isTaken) {
      return t("iot.calibration.produces.nameTaken");
    }

    return COEFFICIENT_NAME_PATTERN.test(to)
      ? undefined
      : t("iot.calibration.produces.nameInvalid");
  }

  // Empty is allowed, and means no bound at all.
  function validateBound(text: string) {
    const parsed = Number(text.trim());
    if (text.trim() === "") {
      return undefined;
    }
    if (!Number.isFinite(parsed)) {
      return t("iot.calibration.invalid.number");
    }

    // Whole numbers only for a whole-number array, as retyping one to it already enforces.
    const isFractionOfWhole = spec.type === "integer_array" && !Number.isInteger(parsed);
    return isFractionOfWhole ? t("iot.calibration.invalid.wholeNumber") : undefined;
  }

  function validateLength(text: string) {
    const parsed = Number(text.trim());
    const isAllowed =
      Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_COEFFICIENT_ARRAY_LENGTH;

    return isAllowed
      ? undefined
      : t("iot.calibration.invalid.wholeRange", { min: 1, max: MAX_COEFFICIENT_ARRAY_LENGTH });
  }

  function commitBound(field: "min" | "max", text: string) {
    const isEmpty = text.trim() === "";
    onChange(withBound(spec, field, isEmpty ? undefined : Number(text.trim())));
  }

  function commitLength(text: string) {
    onChange(withLength(spec, Number(text.trim())));
  }

  function boundToken(field: "min" | "max") {
    const value = spec[field];
    return (
      <InlineToken
        value={value === undefined ? "" : String(value)}
        label={t(`iot.calibration.produces.${field}`, { name })}
        canEdit={canEdit}
        mono
        inputMode="decimal"
        // Not "…": the rig already uses that glyph for a range's own separator
        // ("current_a 0…10 A"), and a bound with nothing set is a different fact.
        placeholder={t("iot.calibration.produces.noBound")}
        validate={validateBound}
        onCommit={(text) => commitBound(field, text)}
      />
    );
  }

  return (
    <li className="group col-span-3 grid grid-cols-subgrid items-baseline py-0.5 leading-7">
      <span className="pl-4">
        <InlineToken
          value={name}
          label={t("iot.calibration.produces.coefficient")}
          canEdit={canEdit}
          mono
          invalid={nameError}
          validate={validateName}
          onCommit={onRename}
          className="font-mono text-[15px]"
        />
      </span>

      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <InlineChoice
          value={spec.type}
          label={t("iot.calibration.produces.type")}
          options={COEFFICIENT_TYPES.map((type: CoefficientType) => ({
            value: type,
            label: t(`iot.calibration.produces.typeName.${type}`),
          }))}
          canEdit={canEdit}
          mono={false}
          onCommit={(type) => onChange(retypeCoefficient(spec, type))}
        />

        {isArray && (
          <span className="text-muted-foreground text-sm">
            <InlineToken
              value={String(spec.length)}
              label={t("iot.calibration.produces.entries")}
              canEdit={canEdit}
              mono
              inputMode="decimal"
              validate={validateLength}
              onCommit={commitLength}
            />{" "}
            {t("iot.calibration.produces.entriesSuffix")}
          </span>
        )}

        {/* Reading closes the affordance: with nothing to click and neither bound set,
          "between none and none" would be noise rather than a fact. */}
        {(canEdit || spec.min !== undefined || spec.max !== undefined) && (
          <span className="text-muted-foreground text-sm">
            {t("iot.calibration.produces.between")} {boundToken("min")}{" "}
            {t("iot.calibration.produces.and")} {boundToken("max")}
          </span>
        )}

        {!isWritable && (
          <span className="text-muted-foreground text-xs">
            {t("iot.calibration.produces.recordedOnly")}
          </span>
        )}
      </p>

      {canEdit && (
        <CalibrationRowRemove
          label={t("iot.calibration.produces.removeCoefficient", { name })}
          onRemove={onRemove}
          revealClassName="group-hover:text-muted-foreground/70"
        />
      )}
    </li>
  );
}
