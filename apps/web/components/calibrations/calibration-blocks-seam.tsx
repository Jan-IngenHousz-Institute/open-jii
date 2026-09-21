"use client";

import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type { CalibrationOutputSchema } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { familyCalibrationCapabilities, isSensorFamily } from "@repo/iot";
import { Badge } from "@repo/ui/components/badge";

interface CalibrationBlocksSeamProps {
  outputSchema: CalibrationOutputSchema;
  family: CalibrationFamily;
}

/** Coefficient names the writer registry has a console command for, per block. */
function writableNames(family: CalibrationFamily): Map<string, Set<string>> {
  const writable = new Map<string, Set<string>>();
  if (!isSensorFamily(family)) {
    return writable;
  }

  for (const [block, coefficients] of Object.entries(
    familyCalibrationCapabilities(family).writableCoefficients,
  )) {
    writable.set(block, new Set((coefficients ?? []).map((coefficient) => coefficient.name)));
  }
  return writable;
}

/**
 * What the fit submits, and how far each coefficient gets.
 *
 * A block the family has no console command for is not a mistake: the run still records
 * it, and a technician reads it off the approval. But an author choosing between two
 * names should know which one ends up on the device, and that is decided by a registry
 * they cannot see from here.
 */
export function CalibrationBlocksSeam({ outputSchema, family }: CalibrationBlocksSeamProps) {
  const { t } = useTranslation("iot");
  const writable = writableNames(family);

  const blocks = Object.entries(outputSchema.blocks);
  if (blocks.length === 0) {
    return null;
  }

  function renderCoefficient(block: string, name: string) {
    const reaches = writable.get(block)?.has(name) ?? false;
    return (
      <li key={`${block}.${name}`} className="flex items-baseline gap-2">
        <code className="text-foreground text-xs">
          {block}.{name}
        </code>
        <Badge variant={reaches ? "secondary" : "outline"} className="text-[10px]">
          {reaches
            ? t("iot.calibration.seam.reachesDevice")
            : t("iot.calibration.seam.recordedOnly")}
        </Badge>
      </li>
    );
  }

  function renderBlock([block, coefficients]: [string, Record<string, unknown>]) {
    return Object.keys(coefficients).map((name) => renderCoefficient(block, name));
  }

  return (
    <div className="ml-3 border-l py-2 pl-5">
      <p className="text-muted-foreground mb-1 text-xs">{t("iot.calibration.seam.submits")}</p>
      <ul className="space-y-1">{blocks.map(renderBlock)}</ul>
    </div>
  );
}
