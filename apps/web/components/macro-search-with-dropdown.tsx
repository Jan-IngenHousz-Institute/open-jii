"use client";

import { ChevronsUpDown } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import type { Macro } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components";
import { Popover, PopoverTrigger } from "@repo/ui/components";

import { MacroSearchPopover } from "./macro-search-popover";

export interface MacroSearchWithDropdownProps {
  availableMacros: Macro[];
  value: string;
  placeholder?: string;
  loading?: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddMacro: (macroId: string) => void | Promise<void>;
  isAddingMacro: boolean;
  disabled?: boolean;
}

export function MacroSearchWithDropdown({
  availableMacros,
  value,
  placeholder,
  loading = false,
  searchValue,
  onSearchChange,
  onAddMacro,
  isAddingMacro,
  disabled = false,
}: MacroSearchWithDropdownProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("common");

  // Snapshot the selected macro when it's visible in the current list.
  const selectedSnapshotRef = useRef<Macro | undefined>(undefined);

  const currentMatch = value ? availableMacros.find((m) => m.id === value) : undefined;

  // Keep selected macro snapshot in sync with current value and available macros
  useEffect(() => {
    if (!value) {
      // Clear snapshot when no macro is selected
      selectedSnapshotRef.current = undefined;
    } else if (currentMatch && selectedSnapshotRef.current?.id !== currentMatch.id) {
      // Update snapshot when we have a new match that's different from current snapshot
      selectedSnapshotRef.current = currentMatch;
    }
  }, [value, currentMatch]);

  const selectedMacro = selectedSnapshotRef.current;

  const dropdownMacros = availableMacros.filter((macro) => macro.id !== value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={"hover:bg-surface-light w-full justify-between p-0 font-normal"}
          disabled={disabled}
        >
          <div className="flex w-full items-center gap-3 px-3 py-2.5">
            {selectedMacro ? (
              <>
                {selectedMacro.createdByName && (
                  <Avatar className="h-6 w-6">
                    <AvatarImage src="" alt={selectedMacro.createdByName} />
                    <AvatarFallback className="text-xs">
                      {selectedMacro.createdByName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex flex-1 flex-col">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium">
                    {selectedMacro.name}
                  </span>
                  <span className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                    {selectedMacro.language}
                    {selectedMacro.createdByName && (
                      <>
                        • {t("common.by")} {selectedMacro.createdByName}
                      </>
                    )}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex-1">{placeholder ?? t("experiments.searchMacros")}</div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <MacroSearchPopover
        availableMacros={dropdownMacros}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onAddMacro={onAddMacro}
        isAddingMacro={isAddingMacro}
        loading={loading}
        setOpen={setOpen}
        popoverClassName="w-[var(--radix-popover-trigger-width)]"
      />
    </Popover>
  );
}
