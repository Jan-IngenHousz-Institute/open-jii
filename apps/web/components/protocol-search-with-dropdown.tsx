"use client";

import { ChevronsUpDown } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";

import type { Protocol } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components";
import { Popover, PopoverTrigger } from "@repo/ui/components";

import { ProtocolSearchPopover } from "./protocol-search-popover";

export interface ProtocolSearchWithDropdownProps {
  availableProtocols: Protocol[];
  value: string;
  placeholder?: string;
  loading?: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddProtocol: (protocolId: string) => void | Promise<void>;
  isAddingProtocol: boolean;
}

export function ProtocolSearchWithDropdown({
  availableProtocols,
  value,
  placeholder,
  loading = false,
  searchValue,
  onSearchChange,
  onAddProtocol,
  isAddingProtocol,
}: ProtocolSearchWithDropdownProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("common");

  // Snapshot the selected protocol when it’s visible in the current list.
  const selectedSnapshotRef = useRef<Protocol | undefined>(undefined);

  const currentMatch = useMemo(
    () => (value ? availableProtocols.find((p) => p.id === value) : undefined),
    [availableProtocols, value],
  );

  // Keep selected protocol snapshot in sync with current value and available protocols
  if (!value) {
    // Clear snapshot when no protocol is selected
    selectedSnapshotRef.current = undefined;
  } else if (currentMatch && selectedSnapshotRef.current?.id !== currentMatch.id) {
    // Update snapshot when we have a new match that's different from current snapshot
    selectedSnapshotRef.current = currentMatch;
  }

  const selectedProtocol = selectedSnapshotRef.current;

  // Dropdown list should not include the currently selected id
  const dropdownProtocols = useMemo(
    () => availableProtocols.filter((protocol) => protocol.id !== value),
    [availableProtocols, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-60 justify-between p-0"
        >
          <div className="flex w-full items-center gap-3 px-3 py-2">
            {selectedProtocol ? (
              <>
                {selectedProtocol.createdByName && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={selectedProtocol.createdByName} />
                    <AvatarFallback className="text-xs">
                      {selectedProtocol.createdByName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex flex-1 flex-col">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap font-medium">
                    {t("common.protocolLabel")}: {selectedProtocol.name}
                  </span>
                  <span className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                    #{selectedProtocol.family}
                    {selectedProtocol.createdByName && (
                      <>
                        • {t("common.by")} {selectedProtocol.createdByName}
                      </>
                    )}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex-1">{placeholder ?? t("experiments.searchProtocols")}</div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <ProtocolSearchPopover
        availableProtocols={dropdownProtocols}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onAddProtocol={onAddProtocol}
        isAddingProtocol={isAddingProtocol}
        loading={loading}
        setOpen={setOpen}
      />
    </Popover>
  );
}
