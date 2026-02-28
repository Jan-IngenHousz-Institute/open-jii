"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "@/hooks/useLocale";
import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { Macro } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components";

import { useMacros } from "../../hooks/macro/useMacros/useMacros";
import { useAddCompatibleMacro } from "../../hooks/protocol/useAddCompatibleMacro/useAddCompatibleMacro";
import { useProtocolCompatibleMacros } from "../../hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros";
import { useRemoveCompatibleMacro } from "../../hooks/protocol/useRemoveCompatibleMacro/useRemoveCompatibleMacro";
import { MacroSearchWithDropdown } from "../macro-search-with-dropdown";

interface ProtocolCompatibleMacrosCardProps {
  protocolId: string;
}

export function ProtocolCompatibleMacrosCard({ protocolId }: ProtocolCompatibleMacrosCardProps) {
  const { t } = useTranslation();
  const locale = useLocale();

  const { data: compatibleData, isLoading } = useProtocolCompatibleMacros(protocolId);
  const compatibleMacros = useMemo(() => compatibleData?.body ?? [], [compatibleData]);

  const { mutateAsync: addMacros, isPending: isAdding } = useAddCompatibleMacro(protocolId);
  const { mutateAsync: removeMacro, isPending: isRemoving } = useRemoveCompatibleMacro(protocolId);

  // Macro search for the add dropdown
  const [macroSearch, setMacroSearch] = useState("");
  const [debouncedMacroSearch, isDebounced] = useDebounce(macroSearch, 300);
  const { data: macroList } = useMacros({
    search: debouncedMacroSearch || undefined,
  });

  const compatibleMacroIds = useMemo(
    () => new Set(compatibleMacros.map((entry) => entry.macro.id)),
    [compatibleMacros],
  );

  // Filter out already-linked macros from the search dropdown
  const availableMacros: Macro[] = useMemo(
    () => (macroList ?? []).filter((m) => !compatibleMacroIds.has(m.id)),
    [macroList, compatibleMacroIds],
  );

  const handleAddMacro = async (macroId: string) => {
    await addMacros({
      params: { id: protocolId },
      body: { macroIds: [macroId] },
    });
    setMacroSearch("");
  };

  const handleRemoveMacro = async (macroId: string) => {
    await removeMacro({
      params: { id: protocolId, macroId },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("protocolSettings.compatibleMacros")}</CardTitle>
        <CardDescription>{t("protocolSettings.compatibleMacrosDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* List of currently linked macros */}
        {isLoading ? (
          <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
        ) : compatibleMacros.length > 0 ? (
          <div className="space-y-2">
            {compatibleMacros.map((entry) => (
              <div
                key={entry.macro.id}
                className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    href={`/${locale}/platform/macros/${entry.macro.id}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {entry.macro.name}
                  </Link>
                  <Link
                    href={`/${locale}/platform/macros/${entry.macro.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="text-muted-foreground h-3.5 w-3.5" />
                  </Link>
                  <span className="text-muted-foreground text-xs">{entry.macro.language}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleRemoveMacro(entry.macro.id)}
                  disabled={isRemoving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {t("protocolSettings.noCompatibleMacros")}
          </p>
        )}

        {/* Add macro dropdown */}
        <MacroSearchWithDropdown
          availableMacros={availableMacros}
          value=""
          placeholder={t("protocolSettings.addCompatibleMacro")}
          loading={!isDebounced}
          searchValue={macroSearch}
          onSearchChange={setMacroSearch}
          onAddMacro={handleAddMacro}
          isAddingMacro={isAdding}
        />
      </CardContent>
    </Card>
  );
}
