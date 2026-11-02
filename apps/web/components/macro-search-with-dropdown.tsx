"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { personName } from "@/components/people/person-name";
import { useLocale } from "@/hooks/useLocale";
import { ChevronsUpDown, ExternalLink } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import type { MacroListEntry } from "@repo/api/domains/macro/macro.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverTrigger } from "@repo/ui/components/popover";

import { MacroSearchPopover } from "./macro-search-popover";

export interface MacroSearchWithDropdownProps {
  availableMacros: MacroListEntry[];
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
  const selectedSnapshotRef = useRef<MacroListEntry | undefined>(undefined);

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
  const author =
    selectedMacro &&
    personName({ displayName: selectedMacro.createdByName }, t, {
      placement: "byline",
    });

  const dropdownMacros = availableMacros.filter((macro) => macro.id !== value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="hover:bg-muted w-full justify-between py-6 text-left font-normal"
          disabled={disabled}
        >
          <div className="min-w-0 flex-1">
            {selectedMacro ? (
              <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0 items-center gap-1">
                  <span className="truncate text-sm font-medium">{selectedMacro.name}</span>
                  <IntentLink
                    href={`/${locale}/platform/macros/${selectedMacro.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("experiments.seeMacroDetails")}
                    aria-label={t("experiments.seeMacroDetails")}
                    className="group shrink-0 p-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="group-hover:text-muted-foreground text-primary h-4 w-4 transition-colors" />
                  </IntentLink>
                </div>
                <span className="text-muted-foreground truncate text-xs">
                  {selectedMacro.language}
                  {author && <> • {t("common.byPerson", { name: author })}</>}
                </span>
              </div>
            ) : (
              <div className="text-muted-foreground italic">
                {placeholder ?? t("experiments.searchMacros")}
              </div>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
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
