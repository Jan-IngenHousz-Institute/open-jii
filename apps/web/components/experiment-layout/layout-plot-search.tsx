"use client";

import { useState } from "react";

import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { SearchInput } from "@repo/ui/components/search-input";

import { UnitName } from "./unit-name";

interface LayoutPlotSearchProps {
  units: readonly ExperimentUnit[];
  levelName: string;
  onFind: (unit: ExperimentUnit) => void;
}

export function LayoutPlotSearch({ units, levelName, onFind }: LayoutPlotSearchProps) {
  const { t } = useTranslation("experiments");
  const [query, setQuery] = useState("");
  const [missing, setMissing] = useState<string | null>(null);

  const handleChange = (value: string) => {
    setQuery(value);
    setMissing(null);
  };

  const handleSearch = (value: string) => {
    const wanted = value.trim().toLowerCase();
    const match = units.find((unit) => unit.active && unit.identifier.toLowerCase() === wanted);

    if (match === undefined) {
      setMissing(value.trim());
      return;
    }
    onFind(match);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-plot-search>
      <SearchInput
        value={query}
        onChange={handleChange}
        onSearch={handleSearch}
        placeholder={t("layout.plot.searchPlaceholder")}
        clearLabel={t("layout.plot.clearSearch")}
        className="w-44"
      />
      {missing === null || missing === "" ? null : (
        <p role="status" className="text-muted-foreground text-sm">
          {t("layout.plot.notFound", { unit: new UnitName(levelName).lower, name: missing })}
        </p>
      )}
    </div>
  );
}
