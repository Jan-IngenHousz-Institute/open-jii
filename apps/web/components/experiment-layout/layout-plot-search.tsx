"use client";

import { useState } from "react";

import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { SearchInput } from "@repo/ui/components/search-input";

interface LayoutPlotSearchProps {
  units: ExperimentUnit[];
  onFind: (unit: ExperimentUnit) => void;
}

export function LayoutPlotSearch({ units, onFind }: LayoutPlotSearchProps) {
  const { t } = useTranslation("experiments");
  const [query, setQuery] = useState("");

  const handleSearch = (value: string) => {
    const wanted = value.trim().toLowerCase();
    const match = units.find((unit) => unit.active && unit.identifier.toLowerCase() === wanted);

    if (match !== undefined) {
      onFind(match);
    }
  };

  return (
    <SearchInput
      value={query}
      onChange={setQuery}
      onSearch={handleSearch}
      placeholder={t("layout.plot.searchPlaceholder")}
      clearLabel={t("layout.plot.clearSearch")}
      className="w-44"
    />
  );
}
