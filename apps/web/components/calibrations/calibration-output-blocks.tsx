"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type {
  CalibrationFamily,
  CalibrationOutputSchema,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { familyCalibrationCapabilities, isSensorFamily } from "@repo/iot";
import { Alert, AlertDescription } from "@repo/ui/components/alert";

interface CalibrationOutputBlocksProps {
  family: CalibrationFamily;
  outputSchema: CalibrationOutputSchema;
}

/**
 * The coefficients this definition produces, and whether the platform can write each one
 * back to a device.
 *
 * This is the coupling that otherwise fails silently: a block whose name no writer covers
 * captures, fits, passes review and is approved, and then never reaches the hardware. The
 * author finds out at the bench, under a message that reads like the family is
 * unsupported. Saying it here is the whole point of the card.
 */
export function CalibrationOutputBlocks({ family, outputSchema }: CalibrationOutputBlocksProps) {
  const { t } = useTranslation("iot");

  const writable = isSensorFamily(family)
    ? familyCalibrationCapabilities(family).writableCoefficients
    : {};
  const blocks = Object.entries(outputSchema.blocks);

  function isWritable(block: string, coefficient: string): boolean {
    return writable[block]?.includes(coefficient) ?? false;
  }

  const unwritable = blocks.flatMap(([block, coefficients]) =>
    Object.keys(coefficients)
      .filter((coefficient) => !isWritable(block, coefficient))
      .map((coefficient) => `${block}.${coefficient}`),
  );

  function describeSpec(spec: CalibrationOutputSchema["blocks"][string][string]): string {
    const bounds =
      spec.min === undefined && spec.max === undefined
        ? ""
        : ` (${String(spec.min ?? "")}…${String(spec.max ?? "")})`;
    return spec.type === "number" ? `number${bounds}` : `${spec.type}[${spec.length}]${bounds}`;
  }

  function renderCoefficient(
    block: string,
    coefficient: string,
    spec: (typeof blocks)[number][1][string],
  ) {
    const written = isWritable(block, coefficient);
    return (
      <div key={coefficient} className="flex flex-wrap items-center gap-2 text-sm">
        {written ? (
          <CheckCircle2 className="text-primary size-3.5 shrink-0" aria-hidden />
        ) : (
          <AlertTriangle className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
        )}
        <span className="font-mono">{coefficient}</span>
        <span className="text-muted-foreground font-mono text-xs">{describeSpec(spec)}</span>
      </div>
    );
  }

  function renderBlock([block, coefficients]: (typeof blocks)[number]) {
    return (
      <div key={block} className="space-y-1">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{block}</p>
        <div className="space-y-1">
          {Object.entries(coefficients).map(([coefficient, spec]) =>
            renderCoefficient(block, coefficient, spec),
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">{blocks.map(renderBlock)}</div>
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
