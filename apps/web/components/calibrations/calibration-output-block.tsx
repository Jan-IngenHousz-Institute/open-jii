"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import type { CoefficientSpec } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import type { WritableCoefficient } from "@repo/iot";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import { CalibrationCoefficientRow } from "./calibration-coefficient-row";
import { COEFFICIENT_NAME_PATTERN, specForWritable, uniqueName } from "./output-schema-edits";

/** What a coefficient the author adds by hand is called before they rename it. */
const NEW_COEFFICIENT = "coefficient";

interface CalibrationOutputBlockProps {
  block: string;
  coefficients: Record<string, CoefficientSpec>;
  /** What the platform can write in this block, from the driver registry. */
  writable: WritableCoefficient[];
  /** Every block in the schema, this one included, so a rename cannot collide. */
  takenBlocks: string[];
  canEdit: boolean;
  onRename: (to: string) => void;
  onRemove: () => void;
  onSetCoefficient: (name: string, spec: CoefficientSpec) => void;
  onRenameCoefficient: (from: string, to: string) => void;
  onRemoveCoefficient: (name: string) => void;
}

/**
 * One block of coefficients, which is the unit a device is written and a run is reviewed
 * in: a bench that produced two of three blocks writes the two and records why the third
 * is missing.
 */
export function CalibrationOutputBlock({
  block,
  coefficients,
  writable,
  takenBlocks,
  canEdit,
  onRename,
  onRemove,
  onSetCoefficient,
  onRenameCoefficient,
  onRemoveCoefficient,
}: CalibrationOutputBlockProps) {
  const { t } = useTranslation("iot");
  const blockId = useId();

  const [draftBlock, setDraftBlock] = useState(block);
  const [committedBlock, setCommittedBlock] = useState(block);

  if (block !== committedBlock) {
    setCommittedBlock(block);
    setDraftBlock(block);
  }

  const isTaken = draftBlock !== block && takenBlocks.includes(draftBlock);
  const isMalformed = !COEFFICIENT_NAME_PATTERN.test(draftBlock);
  const blockError = isTaken
    ? t("iot.calibration.produces.blockTaken")
    : isMalformed
      ? t("iot.calibration.produces.nameInvalid")
      : null;

  const declared = Object.keys(coefficients);
  const offered = writable.filter((candidate) => !declared.includes(candidate.name));

  function handleBlockChange(value: string) {
    setDraftBlock(value);
    if (value !== block && COEFFICIENT_NAME_PATTERN.test(value) && !takenBlocks.includes(value)) {
      onRename(value);
    }
  }

  function handleBlockBlur() {
    if (blockError !== null) {
      setDraftBlock(block);
    }
  }

  function addWritable(coefficient: WritableCoefficient) {
    onSetCoefficient(coefficient.name, specForWritable(coefficient));
  }

  function addPlain() {
    onSetCoefficient(uniqueName(NEW_COEFFICIENT, declared), { type: "number" });
  }

  function renderOffered(coefficient: WritableCoefficient) {
    return (
      <DropdownMenuItem
        key={coefficient.name}
        className="font-mono"
        onSelect={() => addWritable(coefficient)}
      >
        {coefficient.name}
      </DropdownMenuItem>
    );
  }

  function renderCoefficient([name, spec]: [string, CoefficientSpec], index: number) {
    return (
      <CalibrationCoefficientRow
        // Positional, so renaming one does not remount its row mid-keystroke.
        key={index}
        name={name}
        spec={spec}
        isWritable={writable.some((candidate) => candidate.name === name)}
        takenNames={declared}
        canEdit={canEdit}
        onRename={(to) => onRenameCoefficient(name, to)}
        onChange={(next) => onSetCoefficient(name, next)}
        onRemove={() => onRemoveCoefficient(name)}
      />
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-40 flex-1 space-y-1">
          <Label htmlFor={blockId} className="text-xs">
            {t("iot.calibration.produces.block")}
          </Label>
          <Input
            id={blockId}
            value={draftBlock}
            onChange={(event) => handleBlockChange(event.target.value)}
            onBlur={handleBlockBlur}
            disabled={!canEdit}
            aria-invalid={blockError !== null}
            className="font-mono"
          />
        </div>

        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={t("iot.calibration.produces.removeBlock", { block })}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
      </div>

      {blockError !== null && <p className="text-destructive text-xs">{blockError}</p>}

      <ul className="space-y-2">{Object.entries(coefficients).map(renderCoefficient)}</ul>

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Plus className="mr-2 size-4" aria-hidden />
              {t("iot.calibration.produces.addCoefficient")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {offered.map(renderOffered)}
            <DropdownMenuItem onSelect={addPlain}>
              {t("iot.calibration.produces.addPlain")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
