"use client";

import { ChevronsUpDown } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

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
  disabled?: boolean;
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
  disabled = false,
}: ProtocolSearchWithDropdownProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("common");

  // Snapshot the selected protocol when it’s visible in the current list.
  const selectedSnapshotRef = useRef<Protocol | undefined>(undefined);

  const currentMatch = value ? availableProtocols.find((p) => p.id === value) : undefined;

  // Keep selected protocol snapshot in sync with current value and available protocols
  useEffect(() => {
    if (!value) {
      // Clear snapshot when no protocol is selected
      selectedSnapshotRef.current = undefined;
    } else if (currentMatch && selectedSnapshotRef.current?.id !== currentMatch.id) {
      // Update snapshot when we have a new match that's different from current snapshot
      selectedSnapshotRef.current = currentMatch;
    }
  }, [value, currentMatch]);

  const selectedProtocol = selectedSnapshotRef.current;

  const dropdownProtocols = availableProtocols.filter((protocol) => protocol.id !== value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={"hover:bg-surface-light w-full justify-between p-0 font-normal"}
        >
          <div className="flex w-full items-center gap-3 px-3 py-2.5">
            {selectedProtocol ? (
              <>
                {selectedProtocol.createdByName && (
                  <Avatar className="h-6 w-6">
                    <AvatarImage src="" alt={selectedProtocol.createdByName} />
                    <AvatarFallback className="text-xs">
                      {selectedProtocol.createdByName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex flex-1 flex-col">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium">
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
