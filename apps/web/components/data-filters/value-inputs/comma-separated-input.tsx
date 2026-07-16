"use client";

import type { ChangeEvent } from "react";

import type { ExperimentDataFilterValue } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { getColumnKind } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";

export interface CommaSeparatedInputProps {
  value: ExperimentDataFilterValue;
  onChange: (value: ExperimentDataFilterValue) => void;
  kind: ReturnType<typeof getColumnKind>;
}

export function CommaSeparatedInput({ value, onChange, kind }: CommaSeparatedInputProps) {
  const { t } = useTranslation("common");
  const display = Array.isArray(value) ? value.join(", ") : String(value);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const parts = e.target.value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (kind === "numeric") {
      // Preserve numeric typing per item; non-numeric entries pass through
      // as strings (the schema accepts `(string | number)[]` for `in`).
      onChange(parts.map((s) => (Number.isFinite(Number(s)) ? Number(s) : s)));
      return;
    }

    onChange(parts);
  };

  return (
    <Input
      className="h-9"
      placeholder={t("dataFilters.placeholderCommaSeparated")}
      value={display}
      onChange={handleChange}
    />
  );
}
