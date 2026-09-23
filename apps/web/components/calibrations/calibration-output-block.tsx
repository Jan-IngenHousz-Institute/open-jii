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
import { InlineToken } from "./inline-token";
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
  const isBlockTaken = takenBlocks.filter((entry) => entry === block).length > 1;
  const blockError = isBlockTaken
    ? t("iot.calibration.produces.blockTaken")
    : COEFFICIENT_NAME_PATTERN.test(block)
      ? undefined
      : t("iot.calibration.produces.nameInvalid");
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

  // A subgrid of the schema's own grid, so every block's coefficients share one name
  // column instead of each block sizing its own.
  return (
    <div className="col-span-3 grid grid-cols-subgrid">
      <div className="group/header col-span-3 grid grid-cols-subgrid items-baseline leading-7">
        <InlineToken
          value={block}
          label={t("iot.calibration.produces.block")}
          canEdit={canEdit}
          mono
          invalid={blockError}
          onCommit={onRename}
          className="font-mono text-[15px] font-medium"
        />
        <span />
        {canEdit && (
          <span className="flex h-7 items-center self-start">
            <button
              type="button"
              onClick={onRemove}
              aria-label={t("iot.calibration.produces.removeBlock", { block })}
              className="text-muted-foreground/0 group-hover/header:text-muted-foreground/70 hover:text-destructive! transition-colors"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        )}
      </div>

      <ul className="col-span-3 grid grid-cols-subgrid">
        {Object.entries(coefficients).map(renderCoefficient)}
      </ul>

      {canEdit && (
        <div className="col-span-3 pl-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground -ml-2.5 h-7 text-xs"
              >
                <Plus className="size-3" aria-hidden />
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
        </div>
      )}
    </div>
  );
}
