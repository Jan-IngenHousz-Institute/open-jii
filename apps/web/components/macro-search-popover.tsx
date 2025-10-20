"use client";

import { useLocale } from "@/hooks/useLocale";
import { SearchX, PlusSquare, ExternalLink } from "lucide-react";
import Link from "next/link";
import React, { useCallback } from "react";

import type { Macro } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components";
import { PopoverContent } from "@repo/ui/components";

// Props for the MacroList component
interface MacroListProps {
  macros: Macro[];
  onAddMacro: (macroId: string) => Promise<void> | void;
  isAddingMacro: boolean;
  setOpen: (open: boolean) => void;
  onSearchChange: (value: string) => void;
}

function MacroList({ macros, onAddMacro, isAddingMacro, setOpen, onSearchChange }: MacroListProps) {
  const locale = useLocale();
  const { t } = useTranslation("common");

  const handleAddMacro = useCallback(
    async (e: React.MouseEvent, macroId: string) => {
      e.stopPropagation();
      await onAddMacro(macroId);
      setOpen(false);
      onSearchChange("");
    },
    [onAddMacro, setOpen, onSearchChange],
  );

  return (
    <>
      {macros.map((macro) => (
        <CommandItem
          key={macro.id}
          value={macro.id}
          className="mb-1 flex items-center justify-between gap-2 rounded border p-2"
        >
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            {/* Macro name */}
            <h4 className="text-foreground truncate text-sm font-medium">{macro.name}</h4>

            {/* Language */}
            <div className="text-muted-foreground truncate text-xs">
              <span className="opacity-75">Language:</span>{" "}
              <span className="font-medium">{macro.language}</span>
            </div>

            {/* Created by */}
            {macro.createdByName && (
              <div className="text-muted-foreground truncate text-xs">
                <span className="opacity-75">Created by:</span>{" "}
                <span className="font-medium">{macro.createdByName}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-0">
            {/* Add button */}
            <Button
              variant="ghost"
              size="icon"
              className="text-primary hover:bg-accent/40 h-8 w-8 p-0"
              title={t("experiments.addMacro")}
              onClick={async (e) => handleAddMacro(e, macro.id)}
              disabled={isAddingMacro}
              aria-label={t("experiments.addMacro")}
            >
              <PlusSquare className="h-5 w-5" />
            </Button>
            {/* CTA button for more details */}
            <Link
              href={`/${locale}/platform/macros/${macro.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t("experiments.seeMacroDetails")}
              aria-label={t("experiments.seeMacroDetails")}
              className="group p-1.5"
            >
              <ExternalLink className="group-hover:text-muted-foreground h-5 w-5 transition-colors" />
            </Link>
          </div>
        </CommandItem>
      ))}
    </>
  );
}

// Props for the SearchStatus component
interface SearchStatusProps {
  loading: boolean;
  hasMacros: boolean;
  hasSearchQuery: boolean;
  searchValue: string;
}

// Display appropriate message based on search status
function SearchStatus({ loading, hasMacros, hasSearchQuery, searchValue }: SearchStatusProps) {
  const { t } = useTranslation("common");

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-4 text-sm">
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
        {t("experiments.searchingMacros")}
      </div>
    );
  }

  if (!hasMacros && hasSearchQuery) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center py-6 text-sm">
        <SearchX className="mb-2 h-8 w-8" />
        <span className="mb-1 font-medium">{t("experiments.noMacrosFound")}</span>
        <span className="text-xs">
          {t("experiments.tryDifferentSearchMacros", { searchValue })}
        </span>
      </div>
    );
  }

  if (!hasMacros && !hasSearchQuery) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center py-6 text-sm">
        <span className="mb-1 font-medium">{t("experiments.noMacrosAvailable")}</span>
        <span className="text-xs">{t("experiments.createFirstMacro")}</span>
      </div>
    );
  }

  return null;
}

// Props for the MacroSearchPopover component
export interface MacroSearchPopoverProps {
  availableMacros: Macro[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddMacro: (macroId: string) => Promise<void> | void;
  isAddingMacro: boolean;
  loading: boolean;
  setOpen: (open: boolean) => void;
  popoverClassName?: string;
}

export function MacroSearchPopover({
  availableMacros,
  searchValue,
  onSearchChange,
  onAddMacro,
  isAddingMacro,
  loading,
  setOpen,
  popoverClassName = "w-80",
}: MacroSearchPopoverProps) {
  const { t } = useTranslation("common");

  const hasMacros = availableMacros.length > 0;
  const hasSearchQuery = searchValue.trim().length > 0;

  return (
    <PopoverContent className={`${popoverClassName} p-0`} align="start">
      <Command shouldFilter={false}>
        <CommandInput
          placeholder={t("experiments.searchMacros")}
          value={searchValue}
          onValueChange={onSearchChange}
        />
        <CommandList>
          <CommandEmpty>
            <SearchStatus
              loading={loading}
              hasMacros={hasMacros}
              hasSearchQuery={hasSearchQuery}
              searchValue={searchValue}
            />
          </CommandEmpty>
          <CommandGroup>
            <MacroList
              macros={availableMacros}
              onAddMacro={onAddMacro}
              isAddingMacro={isAddingMacro}
              setOpen={setOpen}
              onSearchChange={onSearchChange}
            />
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
}
