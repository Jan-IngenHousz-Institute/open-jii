"use client";

import { useLocale } from "@/hooks/useLocale";
import { ChevronsUpDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

import type { Command } from "@repo/api/schemas/command.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverTrigger } from "@repo/ui/components/popover";

import { CommandSearchPopover } from "./command-search-popover";

export interface CommandSearchWithDropdownProps {
  availableCommands: Command[];
  value: string;
  placeholder?: string;
  loading?: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddCommand: (commandId: string) => void | Promise<void>;
  isAddingCommand: boolean;
  disabled?: boolean;
}

export function CommandSearchWithDropdown({
  availableCommands,
  value,
  placeholder,
  loading = false,
  searchValue,
  onSearchChange,
  onAddCommand,
  isAddingCommand,
  disabled = false,
}: CommandSearchWithDropdownProps) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const { t } = useTranslation("common");

  // Snapshot the selected command when it’s visible in the current list.
  const selectedSnapshotRef = useRef<Command | undefined>(undefined);

  const currentMatch = value ? availableCommands.find((p) => p.id === value) : undefined;

  // Keep selected command snapshot in sync with current value and available commands
  useEffect(() => {
    if (!value) {
      // Clear snapshot when no command is selected
      selectedSnapshotRef.current = undefined;
    } else if (currentMatch && selectedSnapshotRef.current?.id !== currentMatch.id) {
      // Update snapshot when we have a new match that's different from current snapshot
      selectedSnapshotRef.current = currentMatch;
    }
  }, [value, currentMatch]);

  const selectedCommand = selectedSnapshotRef.current;

  const dropdownCommands = availableCommands.filter((command) => command.id !== value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="hover:bg-surface-light w-full justify-between py-6 text-left font-normal"
        >
          <div className="min-w-0 flex-1">
            {selectedCommand ? (
              <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0 items-center gap-1">
                  <span className="truncate text-sm font-medium">{selectedCommand.name}</span>
                  <Link
                    href={`/${locale}/platform/commands/${selectedCommand.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("experiments.seeCommandDetails")}
                    aria-label={t("experiments.seeCommandDetails")}
                    className="group shrink-0 p-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="group-hover:text-muted-foreground text-primary h-4 w-4 transition-colors" />
                  </Link>
                </div>
                <span className="text-muted-foreground truncate text-xs">
                  {selectedCommand.family} • {t("common.by")} {selectedCommand.createdByName}
                </span>
              </div>
            ) : (
              <div className="text-muted-foreground italic">
                {placeholder ?? t("experiments.searchCommands")}
              </div>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <CommandSearchPopover
        availableCommands={dropdownCommands}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onAddCommand={onAddCommand}
        isAddingCommand={isAddingCommand}
        loading={loading}
        setOpen={setOpen}
      />
    </Popover>
  );
}
