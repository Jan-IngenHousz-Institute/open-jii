"use client";

import { Plus } from "lucide-react";

import type {
  CalibrationFamily,
  CalibrationOutputSchema,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { familyCalibrationCapabilities, isSensorFamily } from "@repo/iot";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { CalibrationOutputBlock } from "./calibration-output-block";
import {
  addBlock,
  removeBlock,
  removeCoefficient,
  renameBlock,
  renameCoefficient,
  setCoefficient,
  specForWritable,
  uniqueName,
} from "./output-schema-edits";

/** What a block and its first coefficient are called before the author renames them. */
const NEW_BLOCK = "block";
const NEW_COEFFICIENT = "coefficient";

interface CalibrationOutputSchemaEditorProps {
  family: CalibrationFamily;
  outputSchema: CalibrationOutputSchema;
  canEdit: boolean;
  onChange: (schema: CalibrationOutputSchema) => void;
}

/** A block no writer covers passes review and never reaches hardware, so the registry's names are offered. */
export function CalibrationOutputSchemaEditor({
  family,
  outputSchema,
  canEdit,
  onChange,
}: CalibrationOutputSchemaEditorProps) {
  const { t } = useTranslation("iot");

  const writable = isSensorFamily(family)
    ? familyCalibrationCapabilities(family).writableCoefficients
    : {};
  const blocks = Object.entries(outputSchema.blocks);
  const declared = blocks.map(([block]) => block);
  const offered = Object.keys(writable).filter((block) => !declared.includes(block));

  const unwritable = blocks.flatMap(([block, coefficients]) =>
    Object.keys(coefficients)
      .filter((coefficient) => !(writable[block] ?? []).some((entry) => entry.name === coefficient))
      .map((coefficient) => `${block}.${coefficient}`),
  );

  function addWritableBlock(block: string) {
    let next = addBlock(outputSchema, block);
    for (const coefficient of writable[block] ?? []) {
      next = setCoefficient(next, block, coefficient.name, specForWritable(coefficient));
    }

    onChange(next);
  }

  // The contract refuses a block that declares no coefficient, so one is started here
  // rather than leaving the author with a block that cannot be saved.
  function addPlainBlock() {
    const block = uniqueName(NEW_BLOCK, declared);
    onChange(
      setCoefficient(addBlock(outputSchema, block), block, NEW_COEFFICIENT, {
        type: "number",
      }),
    );
  }

  function renderOfferedBlock(block: string) {
    return (
      <DropdownMenuItem key={block} className="font-mono" onSelect={() => addWritableBlock(block)}>
        {block}
      </DropdownMenuItem>
    );
  }

  function renderBlock([block, coefficients]: (typeof blocks)[number], index: number) {
    return (
      <CalibrationOutputBlock
        // Positional, so renaming a block does not remount it mid-keystroke.
        key={index}
        block={block}
        coefficients={coefficients}
        writable={writable[block] ?? []}
        takenBlocks={declared}
        canEdit={canEdit}
        onRename={(to) => onChange(renameBlock(outputSchema, block, to))}
        onRemove={() => onChange(removeBlock(outputSchema, block))}
        onSetCoefficient={(name, spec) => onChange(setCoefficient(outputSchema, block, name, spec))}
        onRenameCoefficient={(from, to) =>
          onChange(renameCoefficient(outputSchema, block, from, to))
        }
        onRemoveCoefficient={(name) => onChange(removeCoefficient(outputSchema, block, name))}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Guidance on what to declare, so it goes where there is still something to declare. */}
      {canEdit && (
        <p className="text-muted-foreground text-sm">{t("iot.calibration.produces.hint")}</p>
      )}

      <div className="grid grid-cols-[max-content_1fr_auto] gap-x-6 gap-y-4">
        {blocks.map(renderBlock)}
      </div>

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-2.5 h-7"
            >
              <Plus className="size-3.5" aria-hidden />
              {t("iot.calibration.produces.addBlock")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {offered.map(renderOfferedBlock)}
            <DropdownMenuItem onSelect={addPlainBlock}>
              {t("iot.calibration.produces.addPlainBlock")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {unwritable.length > 0 && (
        <Alert>
          <AlertDescription>
            {t("iot.calibration.detail.notWritable", { coefficients: unwritable.join(", ") })}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
