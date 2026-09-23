"use client";

import { X } from "lucide-react";

import type { CoefficientSpec } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { MAX_COEFFICIENT_ARRAY_LENGTH } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";

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
  block: string;
  name: string;
  spec: CoefficientSpec;
  /** Whether the platform has a console command for this one, or only records it. */
  isWritable: boolean;
  /** Every coefficient in this block, this one included, so a rename cannot collide. */
  takenNames: string[];
  /** Every block in the schema, this one included, so a rename cannot collide. */
  takenBlocks: string[];
  canEdit: boolean;
  onRename: (to: string) => void;
  onRenameBlock: (to: string) => void;
  onChange: (spec: CoefficientSpec) => void;
  onRemove: () => void;
}

/** Bounds are checked at review, the last point before a wrong coefficient reaches a device. */
export function CalibrationCoefficientLine({
  block,
  name,
  spec,
  isWritable,
  takenNames,
  takenBlocks,
  canEdit,
  onRename,
  onRenameBlock,
  onChange,
  onRemove,
}: CalibrationCoefficientLineProps) {
  const { t } = useTranslation("iot");

  const isArray = spec.type !== "number";
  // takenNames/takenBlocks carry every sibling including this one's own, once each; a
  // rename that collides shows up as the name appearing twice, not as it "still" being there.
  const isTaken = takenNames.filter((entry) => entry === name).length > 1;
  const nameError = isTaken
    ? t("iot.calibration.produces.nameTaken")
    : COEFFICIENT_NAME_PATTERN.test(name)
      ? undefined
      : t("iot.calibration.produces.nameInvalid");

  const isBlockTaken = takenBlocks.filter((entry) => entry === block).length > 1;
  const blockError = isBlockTaken
    ? t("iot.calibration.produces.blockTaken")
    : COEFFICIENT_NAME_PATTERN.test(block)
      ? undefined
      : t("iot.calibration.produces.nameInvalid");

  function boundToken(field: "min" | "max") {
    const value = spec[field];
    return (
      <InlineToken
        value={value === undefined ? "" : String(value)}
        label={t(`iot.calibration.produces.${field}`)}
        canEdit={canEdit}
        mono
        inputMode="decimal"
        // Not "…": the rig already uses that glyph for a range's own separator
        // ("current_a 0…10 A"), and a bound with nothing set is a different fact.
        placeholder={t("iot.calibration.produces.noBound")}
        onCommit={(text) => {
          const parsed = Number(text.trim());
          onChange(
            withBound(
              spec,
              field,
              text.trim() === "" || !Number.isFinite(parsed) ? undefined : parsed,
            ),
          );
        }}
      />
    );
  }

  return (
    <li className="group flex flex-wrap items-baseline gap-x-2 py-0.5 leading-7">
      <span className="font-mono text-[15px]">
        <InlineToken
          value={block}
          label={t("iot.calibration.produces.block")}
          canEdit={canEdit}
          mono
          invalid={blockError}
          onCommit={onRenameBlock}
          className="text-muted-foreground font-mono"
        />
        <span className="text-muted-foreground">.</span>
        <InlineToken
          value={name}
          label={t("iot.calibration.produces.coefficient")}
          canEdit={canEdit}
          mono
          invalid={nameError}
          onCommit={onRename}
        />
      </span>

      <InlineChoice
        value={spec.type}
        label={t("iot.calibration.produces.type")}
        options={COEFFICIENT_TYPES.map((type: CoefficientType) => ({
          value: type,
          label: t(`iot.calibration.produces.typeName.${type}`),
        }))}
        canEdit={canEdit}
        mono={false}
        onCommit={(type) => onChange(retypeCoefficient(spec, type as CoefficientType))}
      />

      {isArray && (
        <span className="text-muted-foreground text-sm">
          <InlineToken
            value={String(spec.length)}
            label={t("iot.calibration.produces.entries")}
            canEdit={canEdit}
            mono
            inputMode="decimal"
            onCommit={(text) => {
              const parsed = Number(text.trim());
              if (
                Number.isInteger(parsed) &&
                parsed >= 1 &&
                parsed <= MAX_COEFFICIENT_ARRAY_LENGTH
              ) {
                onChange(withLength(spec, parsed));
              }
            }}
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

      {canEdit && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("iot.calibration.produces.removeCoefficient", { name })}
          className="text-muted-foreground/0 group-hover:text-muted-foreground/70 hover:text-destructive! ml-auto transition-colors"
        >
          <X className="inline size-3" aria-hidden />
        </button>
      )}
    </li>
  );
}
