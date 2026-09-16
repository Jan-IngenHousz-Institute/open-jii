"use client";

import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import type { CoefficientSpec } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { MAX_COEFFICIENT_ARRAY_LENGTH } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
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

import type { CoefficientType } from "./output-schema-edits";
import {
  COEFFICIENT_NAME_PATTERN,
  COEFFICIENT_TYPES,
  retypeCoefficient,
  withBound,
  withLength,
} from "./output-schema-edits";

/** The numeric fields, which are typed through before they are numbers. */
type BoundField = "length" | "min" | "max";

interface CalibrationCoefficientRowProps {
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

/**
 * One number the fit produces: what it is called, what shape it has, and what range is
 * plausible for it.
 *
 * The bounds are not a formality. A fit that lands outside them is reported as out of
 * range at review, which is the last point before a wrong coefficient is written to a
 * device and quietly scales every reading it takes afterwards.
 */
export function CalibrationCoefficientRow({
  name,
  spec,
  isWritable,
  takenNames,
  canEdit,
  onRename,
  onChange,
  onRemove,
}: CalibrationCoefficientRowProps) {
  const { t } = useTranslation("iot");
  const nameId = useId();
  const typeId = useId();

  const [draftName, setDraftName] = useState(name);
  const [committedName, setCommittedName] = useState(name);
  // Numbers are typed through states that are not numbers yet ("-", "1e"), so the text
  // stands until it parses into something the contract would take.
  const [drafts, setDrafts] = useState<Partial<Record<BoundField, string>>>({});

  // Rows are positional, so a removal above this one hands it a different coefficient.
  if (name !== committedName) {
    setCommittedName(name);
    setDraftName(name);
    setDrafts({});
  }

  const isTaken = draftName !== name && takenNames.includes(draftName);
  const isMalformed = !COEFFICIENT_NAME_PATTERN.test(draftName);
  const nameError = isTaken
    ? t("iot.calibration.produces.nameTaken")
    : isMalformed
      ? t("iot.calibration.produces.nameInvalid")
      : null;

  const isArray = spec.type !== "number";
  const wantsWholeBounds = spec.type === "integer_array";

  function handleNameChange(value: string) {
    setDraftName(value);
    if (value !== name && COEFFICIENT_NAME_PATTERN.test(value) && !takenNames.includes(value)) {
      onRename(value);
    }
  }

  function handleNameBlur() {
    if (nameError !== null) {
      setDraftName(name);
    }
  }

  function handleTypeChange(value: string) {
    const type = COEFFICIENT_TYPES.find((candidate) => candidate === value);
    if (type !== undefined) {
      setDrafts({});
      onChange(retypeCoefficient(spec, type));
    }
  }

  function handleBound(field: BoundField, text: string) {
    setDrafts((previous) => ({ ...previous, [field]: text }));

    if (field === "length") {
      const length = Number(text);
      if (Number.isInteger(length) && length >= 1 && length <= MAX_COEFFICIENT_ARRAY_LENGTH) {
        onChange(withLength(spec, length));
      }
      return;
    }

    if (text.trim() === "") {
      onChange(withBound(spec, field, undefined));
      return;
    }

    const value = Number(text);
    const isWhole = !wantsWholeBounds || Number.isInteger(value);
    if (Number.isFinite(value) && isWhole) {
      onChange(withBound(spec, field, value));
    }
  }

  function boundValue(field: BoundField): string {
    const committed = field === "length" ? (isArray ? spec.length : undefined) : spec[field];
    return drafts[field] ?? (committed === undefined ? "" : String(committed));
  }

  function renderTypeOption(type: CoefficientType) {
    return (
      <SelectItem key={type} value={type} className="font-mono">
        {type}
      </SelectItem>
    );
  }

  function renderBound(field: BoundField, label: string) {
    return (
      <div className="min-w-20 flex-1 space-y-1">
        <Label className="text-xs" htmlFor={`${nameId}-${field}`}>
          {label}
        </Label>
        <Input
          id={`${nameId}-${field}`}
          value={boundValue(field)}
          onChange={(event) => handleBound(field, event.target.value)}
          disabled={!canEdit}
          inputMode="decimal"
          className="font-mono"
        />
      </div>
    );
  }

  return (
    <li className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-44 flex-1 space-y-1">
          <Label htmlFor={nameId} className="flex items-center gap-1.5 text-xs">
            {isWritable ? (
              <CheckCircle2 className="text-primary size-3.5 shrink-0" aria-hidden />
            ) : (
              <AlertTriangle className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
            )}
            {t("iot.calibration.produces.coefficient")}
          </Label>
          <Input
            id={nameId}
            value={draftName}
            onChange={(event) => handleNameChange(event.target.value)}
            onBlur={handleNameBlur}
            disabled={!canEdit}
            aria-invalid={nameError !== null}
            className="font-mono"
          />
        </div>

        <div className="min-w-40 flex-1 space-y-1">
          <Label htmlFor={typeId} className="text-xs">
            {t("iot.calibration.produces.type")}
          </Label>
          <Select value={spec.type} onValueChange={handleTypeChange} disabled={!canEdit}>
            <SelectTrigger id={typeId} className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{COEFFICIENT_TYPES.map(renderTypeOption)}</SelectContent>
          </Select>
        </div>

        {isArray && renderBound("length", t("iot.calibration.produces.length"))}
        {renderBound("min", t("iot.calibration.produces.min"))}
        {renderBound("max", t("iot.calibration.produces.max"))}

        {canEdit && (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              aria-label={t("iot.calibration.produces.removeCoefficient", { name })}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>

      {nameError !== null && <p className="text-destructive text-xs">{nameError}</p>}
      {!isWritable && (
        <p className="text-muted-foreground text-xs">
          {t("iot.calibration.produces.recordedOnly")}
        </p>
      )}
    </li>
  );
}
