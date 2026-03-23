"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useState } from "react";
import { useProtocolSearch } from "~/hooks/protocol/useProtocolSearch/useProtocolSearch";

import type { Protocol } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

import { ProtocolSearchWithDropdown } from "../protocol-search-with-dropdown";

interface MeasurementPanelProps {
  selectedProtocolId?: string;
  onChange: (protocolId: string, protocolVersion?: number) => void;
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

  const availableProtocols: Protocol[] = protocolList ?? [];

  const handleAddProtocol = (protocolId: string) => {
    if (disabled) return;
    // Find the selected protocol to get its version
    const selectedProtocol = availableProtocols.find((p) => p.id === protocolId);
    onChange(protocolId, selectedProtocol?.version);
    setProtocolSearch("");
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-jii-dark-green">
          {t("experiments.measurementPanelTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
