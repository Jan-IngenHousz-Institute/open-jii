"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useDebounce } from "@/hooks/useDebounce";
import { useState } from "react";
import { useProtocolSearch } from "~/hooks/protocol/useProtocolSearch/useProtocolSearch";

import type { ProtocolListItem } from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";

import { ProtocolSearchWithDropdown } from "../protocol-search-with-dropdown";

interface MeasurementPanelProps {
  selectedProtocolId?: string;
  onChange: (protocolId: string) => void;
  disabled?: boolean;
}

export function MeasurementPanel({
  selectedProtocolId = "",
  onChange,
  disabled = false,
}: MeasurementPanelProps) {
  const { t } = useTranslation("common");

  // Protocol search state
  const [protocolSearch, setProtocolSearch] = useState("");
  const [debouncedProtocolSearch, isDebounced] = useDebounce(protocolSearch, 300);
  const { protocols: protocolList, isLoading: isFetchingProtocols } =
    useProtocolSearch(debouncedProtocolSearch);

  const availableProtocols: ProtocolListItem[] = protocolList ?? [];

  const handleAddProtocol = (protocolId: string) => {
    if (disabled) return;
    onChange(protocolId);
    setProtocolSearch("");
  };

  return (
    <SettingsCard title={t("experiments.measurementPanelTitle")}>
      <ProtocolSearchWithDropdown
        availableProtocols={availableProtocols}
        value={selectedProtocolId}
        placeholder={t("experiments.searchProtocols")}
        loading={!isDebounced || isFetchingProtocols}
        searchValue={protocolSearch}
        onSearchChange={setProtocolSearch}
        onAddProtocol={handleAddProtocol}
        isAddingProtocol={false}
        disabled={disabled}
      />
    </SettingsCard>
  );
}
