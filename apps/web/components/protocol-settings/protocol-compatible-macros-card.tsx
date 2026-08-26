"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { getMacroLanguageBadgeTone, getMacroLanguageLabel } from "@/util/macro-language";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileCode2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { Macro } from "@repo/api/domains/macro/macro.schema";
import { listItems } from "@repo/api/shared/listing";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";

import { useAddCompatibleMacro } from "../../hooks/protocol/useAddCompatibleMacro/useAddCompatibleMacro";
import { useProtocolCompatibleMacros } from "../../hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros";
import { useRemoveCompatibleMacro } from "../../hooks/protocol/useRemoveCompatibleMacro/useRemoveCompatibleMacro";
import { MacroSearchWithDropdown } from "../macro-search-with-dropdown";

interface ProtocolCompatibleMacrosCardProps {
  protocolId: string;
  embedded?: boolean;
}

export function ProtocolCompatibleMacrosCard({
  protocolId,
  embedded,
}: ProtocolCompatibleMacrosCardProps) {
  const { t } = useTranslation();
  const locale = useLocale();

  const { data: compatibleData, isLoading } = useProtocolCompatibleMacros(protocolId);
  const compatibleMacros = useMemo(() => compatibleData ?? [], [compatibleData]);

  const { mutateAsync: addMacros, isPending: isAdding } = useAddCompatibleMacro(protocolId);
  const { mutateAsync: removeMacro, isPending: isRemoving } = useRemoveCompatibleMacro(protocolId);

  // Macro search for the add dropdown
  const [macroSearch, setMacroSearch] = useState("");
  const [debouncedMacroSearch, isDebounced] = useDebounce(macroSearch, 300);
  const { data: macroResponse } = useQuery(
    orpc.macros.listMacros.queryOptions({
      input: { search: debouncedMacroSearch || undefined },
    }),
  );

  // Narrowed to the array shape: no `page` is sent here, so the response is always
  // the bare list. Deletable once this caller migrates to the envelope.
  const macroData = macroResponse ? listItems(macroResponse) : undefined;
  const macroList = macroData;

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
      id: protocolId,
      macroIds: [macroId],
    });
    setMacroSearch("");
  };

  const handleRemoveMacro = async (macroId: string) => {
    await removeMacro({
      id: protocolId,
      macroId,
    });
  };

  const content = (
    <>
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

      {/* List of currently linked macros */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
      ) : compatibleMacros.length > 0 ? (
        <div className="space-y-3">
          {compatibleMacros.map((entry) => (
            <Card key={entry.macro.id} className="group gap-0 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <FileCode2 className="text-muted-foreground h-4 w-4 shrink-0" />
                    <Link
                      href={`/${locale}/platform/macros/${entry.macro.id}`}
                      className="line-clamp-2 text-sm font-semibold hover:underline"
                    >
                      {entry.macro.name}
                    </Link>
                    <Link
                      href={`/${locale}/platform/macros/${entry.macro.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="text-muted-foreground h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <StatusBadge tone={getMacroLanguageBadgeTone(entry.macro.language)}>
                    {getMacroLanguageLabel(entry.macro.language)}
                  </StatusBadge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => handleRemoveMacro(entry.macro.id)}
                  disabled={isRemoving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{t("protocolSettings.noCompatibleMacros")}</p>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium">{t("protocolSettings.compatibleMacros")}</h4>
          <p className="text-muted-foreground text-sm">
            {t("protocolSettings.compatibleMacrosDescription")}
          </p>
        </div>
        {content}
      </div>
    );
  }

  return (
    <SettingsCard
      title={t("protocolSettings.compatibleMacros")}
      description={t("protocolSettings.compatibleMacrosDescription")}
      contentClassName="space-y-4"
    >
      {content}
    </SettingsCard>
  );
}
