"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "@/hooks/useLocale";
import { getSensorFamilyBadgeTone } from "@/util/sensor-family";
import { ExternalLink, FileJson2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { MacroProtocolEntry } from "@repo/api/domains/macro/macro.schema";
import type { ProtocolListItem } from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";

import { useAddCompatibleProtocol } from "../../hooks/macro/useAddCompatibleProtocol/useAddCompatibleProtocol";
import { useMacroCompatibleProtocols } from "../../hooks/macro/useMacroCompatibleProtocols/useMacroCompatibleProtocols";
import { useRemoveCompatibleProtocol } from "../../hooks/macro/useRemoveCompatibleProtocol/useRemoveCompatibleProtocol";
import { useProtocolSearch } from "../../hooks/protocol/useProtocolSearch/useProtocolSearch";
import { ProtocolSearchWithDropdown } from "../protocol-search-with-dropdown";

interface MacroCompatibleProtocolsCardProps {
  macroId: string;
  embedded?: boolean;
}

export function MacroCompatibleProtocolsCard({
  macroId,
  embedded,
}: MacroCompatibleProtocolsCardProps) {
  const { t } = useTranslation("macro");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();

  const compatibleQuery = useMacroCompatibleProtocols(macroId);
  const isLoading = compatibleQuery.isLoading;
  const compatibleProtocols: MacroProtocolEntry[] = useMemo(
    () => compatibleQuery.data ?? [],
    [compatibleQuery.data],
  );

  const addMutation = useAddCompatibleProtocol(macroId);
  const removeMutation = useRemoveCompatibleProtocol(macroId);
  const isAdding = addMutation.isPending;
  const isRemoving = removeMutation.isPending;

  // Protocol search for the add dropdown
  const [protocolSearch, setProtocolSearch] = useState("");
  const [debouncedProtocolSearch, isDebounced] = useDebounce(protocolSearch, 300);
  const { protocols: protocolList } = useProtocolSearch(debouncedProtocolSearch || undefined);

  const compatibleProtocolIds = useMemo(
    () => new Set(compatibleProtocols.map((entry) => entry.protocol.id)),
    [compatibleProtocols],
  );

  // Filter out already-linked protocols from the search dropdown
  const availableProtocols: ProtocolListItem[] = useMemo(
    () => (protocolList ?? []).filter((p) => !compatibleProtocolIds.has(p.id)),
    [protocolList, compatibleProtocolIds],
  );

  const handleAddProtocol = async (protocolId: string) => {
    await addMutation.mutateAsync({ id: macroId, protocolIds: [protocolId] });
    setProtocolSearch("");
  };

  const handleRemoveProtocol = async (protocolId: string) => {
    await removeMutation.mutateAsync({ id: macroId, protocolId });
  };

  const content = (
    <>
      {/* Add protocol dropdown */}
      <ProtocolSearchWithDropdown
        availableProtocols={availableProtocols}
        value=""
        placeholder={t("macroSettings.addCompatibleProtocol")}
        loading={!isDebounced}
        searchValue={protocolSearch}
        onSearchChange={setProtocolSearch}
        onAddProtocol={handleAddProtocol}
        isAddingProtocol={isAdding}
      />

      {/* List of currently linked protocols */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">{tCommon("common.loading")}</div>
      ) : compatibleProtocols.length > 0 ? (
        <div className="space-y-3">
          {compatibleProtocols.map((entry) => (
            <Card key={entry.protocol.id} className="group gap-0 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <FileJson2 className="text-muted-foreground h-4 w-4 shrink-0" />
                    <Link
                      href={`/${locale}/platform/protocols/${entry.protocol.id}`}
                      className="line-clamp-2 text-sm font-semibold hover:underline"
                    >
                      {entry.protocol.name}
                    </Link>
                    <Link
                      href={`/${locale}/platform/protocols/${entry.protocol.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t("macroSettings.openCompatibleProtocol", {
                        name: entry.protocol.name,
                      })}
                      aria-label={t("macroSettings.openCompatibleProtocol", {
                        name: entry.protocol.name,
                      })}
                      className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none transition-[color,box-shadow] focus-visible:ring-[3px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                  <StatusBadge
                    tone={getSensorFamilyBadgeTone(entry.protocol.family)}
                    className="capitalize"
                  >
                    {entry.protocol.family}
                  </StatusBadge>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
                  aria-label={t("macroSettings.removeCompatibleProtocol", {
                    name: entry.protocol.name,
                  })}
                  onClick={() => handleRemoveProtocol(entry.protocol.id)}
                  disabled={isRemoving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{t("macroSettings.noCompatibleProtocols")}</p>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium">{t("macroSettings.compatibleProtocols")}</h4>
          <p className="text-muted-foreground text-sm">
            {t("macroSettings.compatibleProtocolsDescription")}
          </p>
        </div>
        {content}
      </div>
    );
  }

  return (
    <SettingsCard
      title={t("macroSettings.compatibleProtocols")}
      description={t("macroSettings.compatibleProtocolsDescription")}
      contentClassName="space-y-4"
    >
      {content}
    </SettingsCard>
  );
}
