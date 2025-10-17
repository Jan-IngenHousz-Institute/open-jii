"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useProtocolSearch } from "~/hooks/protocol/useProtocolSearch/useProtocolSearch";

import type { Protocol, CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components";

import { ProtocolList } from "../current-protocols-list";
import { ProtocolSearchWithDropdown } from "../protocol-search-with-dropdown";

interface NewExperimentProtocolsCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentProtocolsCard({ form }: NewExperimentProtocolsCardProps) {
  const { t } = useTranslation("common");

  // Protocol management state
  const [selectedProtocolId, setSelectedProtocolId] = useState("");
  const [addedProtocols, setAddedProtocols] = useState<Protocol[]>([]);
  const [protocolSearch, setProtocolSearch] = useState("");
  const [debouncedProtocolSearch, isDebounced] = useDebounce(protocolSearch, 300);
  const { protocols: protocolList, isLoading: isFetchingProtocols } =
    useProtocolSearch(debouncedProtocolSearch);

  const watchedProtocols = form.watch("protocols");
  const protocols = useMemo(() => watchedProtocols ?? [], [watchedProtocols]);

  // Rehydrate UI from form state whenever protocols change
  useEffect(() => {
    if (!protocolList) return;
    const hydrated = protocols
      .map((p) => protocolList.find((proto) => proto.id === p.protocolId))
      .filter((p): p is Protocol => Boolean(p)); // remove undefined
    setAddedProtocols(hydrated);
  }, [protocols, protocolList]);

  const availableProtocols = useMemo<Protocol[]>(() => {
    if (!protocolList) return [];
    const addedIds = new Set(protocols.map((p) => p.protocolId));
    return protocolList.filter((p) => !addedIds.has(p.id));
  }, [protocolList, protocols]);

  // Add protocol handler
  function handleAddProtocol(protocolId: string) {
    const protocol = availableProtocols.find((p) => p.id === protocolId);
    if (!protocol) return;
    form.setValue("protocols", [...protocols, { protocolId: protocol.id, name: protocol.name }]);
    setAddedProtocols((prev) =>
      prev.some((p) => p.id === protocol.id) ? prev : [...prev, protocol],
    );
    setSelectedProtocolId("");
    setProtocolSearch("");
  }

  // Remove protocol handler
  function handleRemoveProtocol(protocolId: string) {
    form.setValue(
      "protocols",
      protocols.filter((p) => p.protocolId !== protocolId),
    );
    setAddedProtocols((prev) => prev.filter((p) => p.id !== protocolId));
  }

  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <CardTitle>{t("newExperiment.addProtocolsTitle")}</CardTitle>
        <CardDescription>{t("newExperiment.addProtocolsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProtocolSearchWithDropdown
          availableProtocols={availableProtocols}
          value={selectedProtocolId}
          placeholder={t("newExperiment.addProtocolsPlaceholder")}
          loading={!isDebounced || isFetchingProtocols}
          searchValue={protocolSearch}
          onSearchChange={setProtocolSearch}
          onAddProtocol={handleAddProtocol}
          isAddingProtocol={false}
        />
        <ProtocolList
          protocols={addedProtocols}
          onRemoveProtocol={handleRemoveProtocol}
          isRemovingProtocol={false}
          removingProtocolId={null}
        />
      </CardContent>
    </Card>
  );
}
