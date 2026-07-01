"use client";

import type { ExperimentDataFilterValue } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";

export interface NumericRangeInputProps {
  value: ExperimentDataFilterValue;
  onChange: (value: ExperimentDataFilterValue) => void;
}

export function NumericRangeInput({ value, onChange }: NumericRangeInputProps) {
  const { t } = useTranslation("common");
  const tuple: [string | number, string | number] = Array.isArray(value)
    ? [value[0] ?? "", value[1] ?? ""]
    : ["", ""];

  const updateBound = (index: 0 | 1, raw: string) => {
    const next: [string | number, string | number] = [...tuple];
    if (raw === "") {
      next[index] = "";
    } else {
      const n = Number(raw);
      next[index] = Number.isFinite(n) ? n : raw;
    }
    onChange(next);
  };

  const display = (v: string | number) => (v === "" ? "" : String(v));

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        className="h-9 flex-1"
        placeholder={t("dataFilters.rangeFrom")}
        value={display(tuple[0])}
        onChange={(e) => updateBound(0, e.target.value)}
      />
      <span className="text-muted-foreground shrink-0 text-xs">→</span>
      <Input
        type="number"
        className="h-9 flex-1"
        placeholder={t("dataFilters.rangeTo")}
        value={display(tuple[1])}
        onChange={(e) => updateBound(1, e.target.value)}
      />
    </div>
  );
}
