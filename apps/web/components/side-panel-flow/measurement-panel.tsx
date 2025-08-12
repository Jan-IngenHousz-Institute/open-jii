"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useMemo, useState } from "react";
import { useProtocolSearch } from "~/hooks/protocol/useProtocolSearch/useProtocolSearch";

import type { Protocol } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

import { ProtocolSearchWithDropdown } from "../protocol-search-with-dropdown";

interface MeasurementPanelProps {
  selectedProtocolId?: string;
  onChange: (protocolId: string) => void;
  disabled?: boolean;
}

export function MeasurementPanel({ selectedProtocolId = "", onChange, disabled = false }: MeasurementPanelProps) {
  const { t } = useTranslation("common");

  // Protocol search state
  const [protocolSearch, setProtocolSearch] = useState("");
  const [debouncedProtocolSearch, isDebounced] = useDebounce(protocolSearch, 300);
  const { protocols: protocolList, isLoading: isFetchingProtocols } =
    useProtocolSearch(debouncedProtocolSearch);

  const availableProtocols = useMemo<Protocol[]>(() => {
    return protocolList ?? [];
  }, [protocolList]);

  const handleAddProtocol = (protocolId: string) => {
    if (disabled) return;
    onChange(protocolId);
    setProtocolSearch("");
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-jii-dark-green">Measurement Protocol</CardTitle>
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
        />
      </CardContent>
    </Card>
  );
}
