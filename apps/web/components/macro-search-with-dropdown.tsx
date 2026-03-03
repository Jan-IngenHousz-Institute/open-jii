"use client";

import { useLocale } from "@/hooks/useLocale";
import { ChevronsUpDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

import type { Macro } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";
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
  recommendedMacroIds?: Set<string>;
  recommendedReason?: string;
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
  recommendedMacroIds,
  recommendedReason,
}: MacroSearchWithDropdownProps) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
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
          className="hover:bg-surface-light w-full justify-start py-6 text-left font-normal"
          disabled={disabled}
        >
          <div className="flex w-full items-start gap-1">
            {selectedMacro ? (
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 items-center gap-1">
                  <span className="truncate text-sm font-medium">{selectedMacro.name}</span>
                  <Link
                    href={`/${locale}/platform/macros/${selectedMacro.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("experiments.seeMacroDetails")}
                    aria-label={t("experiments.seeMacroDetails")}
                    className="group shrink-0 p-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="group-hover:text-muted-foreground text-primary h-4 w-4 transition-colors" />
                  </Link>
                </div>
                <span className="text-muted-foreground truncate text-xs">
                  {selectedMacro.language} • {t("common.by")} {selectedMacro.createdByName}
                </span>
              </div>
            ) : (
              <div className="text-muted-foreground flex-1 italic">
                {placeholder ?? t("experiments.searchMacros")}
              </div>
            )}

            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 self-center opacity-50" />
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
        recommendedMacroIds={recommendedMacroIds}
        recommendedReason={recommendedReason}
      />
    </Popover>
  );
}
