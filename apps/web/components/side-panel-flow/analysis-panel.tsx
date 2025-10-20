"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useState } from "react";
import { useMacros } from "~/hooks/macro/useMacros/useMacros";

import type { Macro } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

import { MacroSearchWithDropdown } from "../macro-search-with-dropdown";

interface AnalysisPanelProps {
  selectedMacroId?: string;
  onChange: (macroId: string) => void;
  disabled?: boolean;
}

export function AnalysisPanel({
  selectedMacroId = "",
  onChange,
  disabled = false,
}: AnalysisPanelProps) {
  const { t } = useTranslation("common");

  // Macro search state
  const [macroSearch, setMacroSearch] = useState("");
  const [debouncedMacroSearch, isDebounced] = useDebounce(macroSearch, 300);
  const { data: macroList } = useMacros({
    search: debouncedMacroSearch || undefined,
  });

  const availableMacros: Macro[] = macroList ?? [];

  const handleAddMacro = (macroId: string) => {
    if (disabled) return;
    onChange(macroId);
    setMacroSearch("");
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-jii-dark-green">{t("experiments.analysisPanelTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <MacroSearchWithDropdown
          availableMacros={availableMacros}
          value={selectedMacroId}
          placeholder={t("experiments.searchMacros")}
          loading={!isDebounced}
          searchValue={macroSearch}
          onSearchChange={setMacroSearch}
          onAddMacro={handleAddMacro}
          isAddingMacro={false}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
}
