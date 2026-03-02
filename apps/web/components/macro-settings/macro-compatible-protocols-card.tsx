"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "@/hooks/useLocale";
import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { MacroProtocolEntry, Protocol } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components";

import { useAddCompatibleProtocol } from "../../hooks/macro/useAddCompatibleProtocol/useAddCompatibleProtocol";
import { useMacroCompatibleProtocols } from "../../hooks/macro/useMacroCompatibleProtocols/useMacroCompatibleProtocols";
import { useRemoveCompatibleProtocol } from "../../hooks/macro/useRemoveCompatibleProtocol/useRemoveCompatibleProtocol";
import { useProtocolSearch } from "../../hooks/protocol/useProtocolSearch/useProtocolSearch";
import { ProtocolSearchWithDropdown } from "../protocol-search-with-dropdown";

interface MacroCompatibleProtocolsCardProps {
  macroId: string;
}

export function MacroCompatibleProtocolsCard({ macroId }: MacroCompatibleProtocolsCardProps) {
  const { t } = useTranslation("macro");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();

  const compatibleQuery = useMacroCompatibleProtocols(macroId);
  const isLoading = compatibleQuery.isLoading;
  const compatibleProtocols: MacroProtocolEntry[] = useMemo(
    () => (compatibleQuery.data?.body as MacroProtocolEntry[] | undefined) ?? [],
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
  const availableProtocols: Protocol[] = useMemo(
    () => (protocolList ?? []).filter((p) => !compatibleProtocolIds.has(p.id)),
    [protocolList, compatibleProtocolIds],
  );

  const handleAddProtocol = async (protocolId: string) => {
    await addMutation.mutateAsync({
      params: { id: macroId },
      body: { protocolIds: [protocolId] },
    } as never);
    setProtocolSearch("");
  };

  const handleRemoveProtocol = async (protocolId: string) => {
    await removeMutation.mutateAsync({
      params: { id: macroId, protocolId },
    } as never);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("macroSettings.compatibleProtocols")}</CardTitle>
        <CardDescription>{t("macroSettings.compatibleProtocolsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* List of currently linked protocols */}
        {isLoading ? (
          <div className="text-muted-foreground text-sm">{tCommon("common.loading")}</div>
        ) : compatibleProtocols.length > 0 ? (
          <div className="space-y-2">
            {compatibleProtocols.map((entry) => (
              <div
                key={entry.protocol.id}
                className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    href={`/${locale}/platform/protocols/${entry.protocol.id}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {entry.protocol.name}
                  </Link>
                  <Link
                    href={`/${locale}/platform/protocols/${entry.protocol.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="text-muted-foreground h-3.5 w-3.5" />
                  </Link>
                  <span className="text-muted-foreground text-xs">{entry.protocol.family}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleRemoveProtocol(entry.protocol.id)}
                  disabled={isRemoving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {t("macroSettings.noCompatibleProtocols")}
          </p>
        )}

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
      </CardContent>
    </Card>
  );
}
