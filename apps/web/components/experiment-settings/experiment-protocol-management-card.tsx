"use client";

import { useMemo, useState } from "react";

import type { Protocol } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentProtocolAdd } from "../../hooks/experiment/useExperimentProtocolAdd/useExperimentProtocolAdd";
import { useExperimentProtocolRemove } from "../../hooks/experiment/useExperimentProtocolRemove/useExperimentProtocolRemove";
import { useExperimentProtocols } from "../../hooks/experiment/useExperimentProtocols/useExperimentProtocols";
import { useProtocolSearch } from "../../hooks/protocol/useProtocolSearch/useProtocolSearch";
import { useDebounce } from "../../hooks/useDebounce";
import { ProtocolList } from "../current-protocols-list";
import { ProtocolSearchWithDropdown } from "../protocol-search-with-dropdown";

interface ExperimentProtocolManagementProps {
  experimentId: string;
}

export function ExperimentProtocolManagement({ experimentId }: ExperimentProtocolManagementProps) {
  const { t } = useTranslation(undefined, "common");
  // Get experiment protocols
  const {
    data: protocolsData,
    isLoading: isProtocolsLoading,
    isError: isProtocolsError,
  } = useExperimentProtocols(experimentId);

  // Get experiment protocol associations from API response
  const experimentProtocols = useMemo(() => {
    return protocolsData?.body ?? [];
  }, [protocolsData]);

  // Extract protocol details from experiment protocol associations
  const allProtocolData: Protocol[] = useMemo(() => {
    return experimentProtocols.map((p) => p.protocol as Protocol);
  }, [experimentProtocols]);

  // Protocol search with debounced input
  const [protocolSearch, setProtocolSearch] = useState("");
  const [debouncedSearch, isDebounced] = useDebounce(protocolSearch, 300);
  const { protocols: searchResults, isLoading: isFetchingProtocols } =
    useProtocolSearch(debouncedSearch);

  // Add/remove protocol mutations
  const { addProtocols, isPending: isAddingProtocol } = useExperimentProtocolAdd(experimentId);
  const { removeProtocol, isPending: isRemovingProtocol } =
    useExperimentProtocolRemove(experimentId);

  // UI state
  const [selectedProtocolId, setSelectedProtocolId] = useState("");
  const [removingProtocolId, setRemovingProtocolId] = useState<string | null>(null);

  // Filter available protocols (exclude already added)
  const availableProtocols = useMemo<Protocol[]>(() => {
    if (!searchResults) return [];
    const addedIds = new Set(allProtocolData.map((p) => p.id));
    return searchResults.filter((p) => !addedIds.has(p.id));
  }, [searchResults, allProtocolData]);

  // Handle adding a protocol
  const handleAddProtocol = async (protocolId?: string) => {
    const idToAdd = protocolId ?? selectedProtocolId;
    if (!idToAdd) return;
    await addProtocols([{ protocolId: idToAdd }]);
    toast({ description: t("experimentSettings.protocolAdded") });
    setSelectedProtocolId("");
  };

  // Handle removing a protocol
  const handleRemoveProtocol = async (protocolId: string) => {
    setRemovingProtocolId(protocolId);
    try {
      await removeProtocol(protocolId);
      toast({ description: t("experimentSettings.protocolRemoved") });
    } finally {
      setRemovingProtocolId(null);
    }
  };

  if (isProtocolsLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle>{t("experimentSettings.protocolManagement")}</CardTitle>
          <div className="bg-muted/40 h-6 w-32 rounded" />
        </CardHeader>
        <CardContent>
          <div className="bg-muted/40 h-64 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (isProtocolsError) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>{t("experimentSettings.protocolManagement")}</CardTitle>
          <CardDescription className="text-destructive">
            {t("experimentSettings.errorLoadingProtocols")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("experimentSettings.protocolManagement")}</CardTitle>
        <CardDescription>{t("experimentSettings.manageAndOrderProtocols")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add protocol section */}
        <ProtocolSearchWithDropdown
          availableProtocols={availableProtocols}
          value={selectedProtocolId}
          onValueChange={setSelectedProtocolId}
          placeholder={t("experimentSettings.addProtocolPlaceholder")}
          loading={!isDebounced || isFetchingProtocols}
          searchValue={protocolSearch}
          onSearchChange={setProtocolSearch}
          onAddProtocol={handleAddProtocol}
          isAddingProtocol={isAddingProtocol}
        />
        {/* Current protocols section */}
        <div>
          {allProtocolData.length > 0 && (
            <h6 className="mb-2 text-sm font-medium">{t("experimentSettings.currentProtocols")}</h6>
          )}
          <ProtocolList
            protocols={allProtocolData}
            onRemoveProtocol={handleRemoveProtocol}
            isRemovingProtocol={isRemovingProtocol}
            removingProtocolId={removingProtocolId}
          />
        </div>
      </CardContent>
    </Card>
  );
}
