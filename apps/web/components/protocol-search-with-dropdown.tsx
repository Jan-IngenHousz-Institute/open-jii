"use client";

import { useLocale } from "@/hooks/useLocale";
import { ChevronsUpDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

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
  const locale = useLocale();
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
          className="hover:bg-surface-light w-full justify-start py-6 text-left font-normal"
        >
          <div className="flex w-full items-start gap-1">
            {selectedProtocol ? (
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 items-center gap-1">
                  <span className="truncate text-sm font-medium">{selectedProtocol.name}</span>
                  <Link
                    href={`/${locale}/platform/protocols/${selectedProtocol.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("experiments.seeProtocolDetails")}
                    aria-label={t("experiments.seeProtocolDetails")}
                    className="group shrink-0 p-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="group-hover:text-muted-foreground text-primary h-4 w-4 transition-colors" />
                  </Link>
                </div>
                <span className="text-muted-foreground truncate text-xs">
                  {selectedProtocol.family} • {t("common.by")} {selectedProtocol.createdByName}
                </span>
              </div>
            ) : (
              <div className="text-muted-foreground flex-1 italic">
                {placeholder ?? t("experiments.searchProtocols")}
              </div>
            )}

            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 self-center opacity-50" />
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
