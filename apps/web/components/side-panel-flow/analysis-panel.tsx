"use client";

import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolCompatibleMacros } from "@/hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros";
import { useDebounce } from "@/hooks/useDebounce";
import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { useMacros } from "~/hooks/macro/useMacros/useMacros";

import type { Macro } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

import { MacroSearchWithDropdown } from "../macro-search-with-dropdown";

interface AnalysisPanelProps {
  selectedMacroId?: string;
  onChange: (macroId: string) => void;
  disabled?: boolean;
  upstreamProtocolId?: string;
}

export function AnalysisPanel({
  selectedMacroId = "",
  onChange,
  disabled = false,
  upstreamProtocolId,
}: AnalysisPanelProps) {
  const { t } = useTranslation("common");

  // Macro search state
  const [macroSearch, setMacroSearch] = useState("");
  const [debouncedMacroSearch, isDebounced] = useDebounce(macroSearch, 300);
  const { data: macroList } = useMacros({
    search: debouncedMacroSearch || undefined,
  });

  // Fetch the upstream protocol name for recommendation context
  const { data: upstreamProtocol } = useProtocol(upstreamProtocolId ?? "", !!upstreamProtocolId);

  // Fetch compatible macros for the upstream protocol
  const { data: compatibleData } = useProtocolCompatibleMacros(
    upstreamProtocolId ?? "",
    !!upstreamProtocolId,
  );

  const compatibleMacroIds = useMemo(
    () => new Set((compatibleData?.body ?? []).map((entry) => entry.macro.id)),
    [compatibleData],
  );
  const hasCompatibilityData = !!upstreamProtocolId && !!compatibleData;

  // Sort compatible macros first when we have compatibility data
  const availableMacros: Macro[] = useMemo(() => {
    const all = macroList ?? [];
    if (!hasCompatibilityData || compatibleMacroIds.size === 0) return all;
    return [...all].sort((a, b) => {
      const aCompat = compatibleMacroIds.has(a.id) ? 0 : 1;
      const bCompat = compatibleMacroIds.has(b.id) ? 0 : 1;
      return aCompat - bCompat;
    });
  }, [macroList, hasCompatibilityData, compatibleMacroIds]);

  const upstreamProtocolName = upstreamProtocol?.body.name;
  const recommendedReason =
    hasCompatibilityData && compatibleMacroIds.size > 0 && upstreamProtocolName
      ? t("common.compatibleWithProtocol", { protocolName: upstreamProtocolName })
      : undefined;

  const showIncompatibilityWarning =
    selectedMacroId &&
    hasCompatibilityData &&
    compatibleMacroIds.size > 0 &&
    !compatibleMacroIds.has(selectedMacroId);

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
      <CardContent className="space-y-3">
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
          recommendedMacroIds={
            hasCompatibilityData && compatibleMacroIds.size > 0 ? compatibleMacroIds : undefined
          }
          recommendedReason={recommendedReason}
        />

        {showIncompatibilityWarning && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{t("experiments.macroIncompatibilityWarning")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
