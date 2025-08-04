"use client";

import { ChevronsUpDown } from "lucide-react";
import React, { useState } from "react";

import type { Protocol } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";
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

  const selectedProtocol = availableProtocols.find((protocol) => protocol.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-60 justify-between p-0"
        >
          <div className="flex w-full items-center justify-between px-3 py-2">
            {selectedProtocol ? (
              <div className="flex flex-col">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {selectedProtocol.name}
                </span>
                <span className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                  {selectedProtocol.family}
                </span>
              </div>
            ) : (
              (placeholder ?? t("experiments.searchProtocols"))
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <ProtocolSearchPopover
        availableProtocols={availableProtocols}
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
