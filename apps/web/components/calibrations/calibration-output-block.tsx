"use client";

import { Plus, X } from "lucide-react";

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

import { CalibrationCoefficientLine } from "./calibration-coefficient-line";
import { specForWritable, uniqueName } from "./output-schema-edits";

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

/** A block is the unit a device is written and a run is reviewed in. */
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

  const declared = Object.keys(coefficients);
  const offered = writable.filter((candidate) => !declared.includes(candidate.name));

  function addPlain() {
    onSetCoefficient(uniqueName(NEW_COEFFICIENT, declared), { type: "number" });
  }

  function renderOffered(coefficient: WritableCoefficient) {
    return (
      <DropdownMenuItem
        key={coefficient.name}
        className="font-mono"
        onSelect={() => onSetCoefficient(coefficient.name, specForWritable(coefficient))}
      >
        {coefficient.name}
      </DropdownMenuItem>
    );
  }

  function renderCoefficient([name, spec]: [string, CoefficientSpec], index: number) {
    return (
      <CalibrationCoefficientLine
        // Positional, so renaming one does not remount its line mid-keystroke.
        key={index}
        block={block}
        name={name}
        spec={spec}
        isWritable={writable.some((candidate) => candidate.name === name)}
        takenNames={declared}
        takenBlocks={takenBlocks}
        canEdit={canEdit}
        onRename={(to) => onRenameCoefficient(name, to)}
        onRenameBlock={onRename}
        onChange={(next) => onSetCoefficient(name, next)}
        onRemove={() => onRemoveCoefficient(name)}
      />
    );
  }

  return (
    <div className="group/block">
      <ul>{Object.entries(coefficients).map(renderCoefficient)}</ul>

      {canEdit && (
        <div className="text-muted-foreground flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs">
                <Plus className="mr-1 size-3" aria-hidden />
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

          <button
            type="button"
            onClick={onRemove}
            aria-label={t("iot.calibration.produces.removeBlock", { block })}
            className="hover:text-destructive opacity-0 transition-opacity group-hover/block:opacity-100"
          >
            <X className="inline size-3" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
