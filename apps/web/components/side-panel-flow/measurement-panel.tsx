"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useState } from "react";
import { useCommandSearch } from "~/hooks/command/useCommandSearch/useCommandSearch";

import type { Command } from "@repo/api/schemas/command.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components/card";

import { CommandSearchWithDropdown } from "../command-search-with-dropdown";

interface MeasurementPanelProps {
  selectedCommandId?: string;
  onChange: (commandId: string) => void;
  disabled?: boolean;
}

export function MeasurementPanel({
  selectedCommandId = "",
  onChange,
  disabled = false,
}: MeasurementPanelProps) {
  const { t } = useTranslation("common");

  // Command search state
  const [commandSearch, setCommandSearch] = useState("");
  const [debouncedCommandSearch, isDebounced] = useDebounce(commandSearch, 300);
  const { commands: commandList, isLoading: isFetchingCommands } =
    useCommandSearch(debouncedCommandSearch);

  const availableCommands: Command[] = commandList ?? [];

  const handleAddCommand = (commandId: string) => {
    if (disabled) return;
    onChange(commandId);
    setCommandSearch("");
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-jii-dark-green">
          {t("experiments.measurementPanelTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CommandSearchWithDropdown
          availableCommands={availableCommands}
          value={selectedCommandId}
          placeholder={t("experiments.searchCommands")}
          loading={!isDebounced || isFetchingCommands}
          searchValue={commandSearch}
          onSearchChange={setCommandSearch}
          onAddCommand={handleAddCommand}
          isAddingCommand={false}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
}
