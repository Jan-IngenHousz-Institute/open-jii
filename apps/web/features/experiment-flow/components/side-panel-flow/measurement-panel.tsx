"use client";

import { useProtocolSearch } from "@/features/protocols/hooks/useProtocolSearch/useProtocolSearch";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { ProtocolSearchWithDropdown } from "@/shared/ui/protocol-search-with-dropdown";
import { useState } from "react";

import type { Protocol } from "@repo/api/schemas/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components/card";

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

  const availableProtocols: Protocol[] = protocolList ?? [];

  const handleAddProtocol = (protocolId: string) => {
    if (disabled) return;
    onChange(protocolId);
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
