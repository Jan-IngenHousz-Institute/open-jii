"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "@/hooks/useLocale";
import { ExternalLink, FileJson2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { MacroProtocolEntry } from "@repo/api/schemas/macro.schema";
import type { Protocol } from "@repo/api/schemas/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/card";

import { useAddCompatibleProtocol } from "../../hooks/macro/useAddCompatibleProtocol/useAddCompatibleProtocol";
import { useMacroCompatibleProtocols } from "../../hooks/macro/useMacroCompatibleProtocols/useMacroCompatibleProtocols";
import { useRemoveCompatibleProtocol } from "../../hooks/macro/useRemoveCompatibleProtocol/useRemoveCompatibleProtocol";
import { useProtocolSearch } from "../../hooks/protocol/useProtocolSearch/useProtocolSearch";
import { ProtocolSearchWithDropdown } from "../protocol-search-with-dropdown";

const getFamilyColor = (family: string) => {
  switch (family) {
    case "multispeq":
      return "bg-badge-published";
    case "ambit":
      return "bg-badge-active";
    default:
      return "bg-badge-archived";
  }
};

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
            <div
              key={entry.protocol.id}
              className="shadow-xs group rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md"
            >
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
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="text-muted-foreground h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <Badge className={`${getFamilyColor(entry.protocol.family)} capitalize`}>
                    {entry.protocol.family}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => handleRemoveProtocol(entry.protocol.id)}
                  disabled={isRemoving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
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
    <Card>
      <CardHeader>
        <CardTitle>{t("macroSettings.compatibleProtocols")}</CardTitle>
        <CardDescription>{t("macroSettings.compatibleProtocolsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{content}</CardContent>
    </Card>
  );
}
