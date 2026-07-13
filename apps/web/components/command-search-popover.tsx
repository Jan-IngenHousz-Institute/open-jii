"use client";

import { useLocale } from "@/hooks/useLocale";
import { SearchX, ExternalLink } from "lucide-react";
import Link from "next/link";
import React, { useCallback } from "react";

import type { Command as CommandEntity } from "@repo/api/schemas/command.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command";
import { PopoverContent } from "@repo/ui/components/popover";
import { cva } from "@repo/ui/lib/utils";

const commandItemVariants = cva(
  "mb-1 flex items-center justify-between gap-2 rounded border p-2.5 relative",
  {
    variants: {
      featured: {
        true: "border-secondary/30 from-badge-featured bg-gradient-to-br to-white shadow-xs data-[selected=true]:from-badge-featured/80 data-[selected=true]:to-surface",
        false: "border-gray-200 bg-white",
      },
    },
    defaultVariants: {
      featured: false,
    },
  },
);

// Props for the CommandResults component
interface CommandResultsProps {
  commands: CommandEntity[];
  onAddCommand: (commandId: string) => Promise<void> | void;
  isAddingCommand: boolean;
  setOpen: (open: boolean) => void;
  onSearchChange: (value: string) => void;
}

function CommandResults({
  commands,
  onAddCommand,
  isAddingCommand,
  setOpen,
  onSearchChange,
}: CommandResultsProps) {
  const locale = useLocale();
  const { t } = useTranslation("common");

  const handleAddCommand = useCallback(
    async (commandId: string) => {
      await onAddCommand(commandId);
      setOpen(false);
      onSearchChange("");
    },
    [onAddCommand, setOpen, onSearchChange],
  );

  return (
    <>
      {commands.map((command) => {
        const isPreferred = command.sortOrder !== null;
        return (
          <CommandItem
            key={command.id}
            value={command.id}
            className={commandItemVariants({ featured: isPreferred })}
            onSelect={() => handleAddCommand(command.id)}
            disabled={isAddingCommand}
          >
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              {/* Command name */}
              <div className="mb-1 flex items-center gap-1">
                <h4 className="text-foreground truncate text-sm font-medium">{command.name}</h4>

                <Link
                  href={`/${locale}/platform/commands/${command.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t("experiments.seeCommandDetails")}
                  aria-label={t("experiments.seeCommandDetails")}
                  className="group p-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="group-hover:text-muted-foreground text-primary h-4 w-4 transition-colors" />
                </Link>

                {isPreferred && (
                  <div className="ml-auto">
                    <Badge className={"bg-secondary/30 text-primary"}>
                      {t("common.preferred")}
                    </Badge>
                  </div>
                )}
              </div>
              {/* Family */}
              <div className="text-muted-foreground truncate text-xs">
                <span className="opacity-75">{t("experiments.family")}</span>{" "}
                <span className="font-medium">{command.family}</span>
              </div>

              {/* Created by */}
              {command.createdByName && (
                <div className="text-muted-foreground truncate text-xs">
                  <span className="opacity-75">{t("experiments.createdBy")}</span>{" "}
                  <span className="font-medium">{command.createdByName}</span>
                </div>
              )}
            </div>
          </CommandItem>
        );
      })}
    </>
  );
}

// Props for the SearchStatus component
interface SearchStatusProps {
  loading: boolean;
  hasCommands: boolean;
  hasSearchQuery: boolean;
  searchValue: string;
}

// Display appropriate message based on search status
function SearchStatus({ loading, hasCommands, hasSearchQuery, searchValue }: SearchStatusProps) {
  const { t } = useTranslation("common");

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-4 text-sm">
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
        {t("experiments.searchingCommands")}
      </div>
    );
  }

  if (!hasCommands && hasSearchQuery) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center py-6 text-sm">
        <SearchX className="mb-2 h-8 w-8" />
        <span className="mb-1 font-medium">{t("experiments.noCommandsFound")}</span>
        <span className="text-xs">
          {t("experiments.tryDifferentSearchCommands", { searchValue })}
        </span>
      </div>
    );
  }

  if (!hasCommands && !hasSearchQuery) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center py-6 text-sm">
        <span className="mb-1 font-medium">{t("experiments.noCommandsAvailable")}</span>
        <span className="text-xs">{t("experiments.createFirstCommand")}</span>
      </div>
    );
  }

  return null;
}

// Search field component with clear button
interface SearchFieldProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  isAddingCommand: boolean;
}

function SearchField({ searchValue, onSearchChange, isAddingCommand }: SearchFieldProps) {
  const { t } = useTranslation("common");
  return (
    <div className="relative w-full">
      <CommandInput
        placeholder={t("experiments.searchCommands")}
        value={searchValue}
        onValueChange={onSearchChange}
        disabled={isAddingCommand}
        style={{ paddingRight: 36 }}
      />
      {searchValue && (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 z-10 -translate-y-1/2 text-xl"
        >
          <SearchX />
        </button>
      )}
    </div>
  );
}

export interface CommandSearchPopoverProps {
  availableCommands: CommandEntity[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddCommand: (commandId: string) => Promise<void> | void;
  isAddingCommand: boolean;
  loading: boolean;
  setOpen: (open: boolean) => void;
}

export function CommandSearchPopover({
  availableCommands,
  searchValue,
  onSearchChange,
  onAddCommand,
  isAddingCommand,
  loading,
  setOpen,
}: CommandSearchPopoverProps) {
  const hasCommands = availableCommands.length > 0;
  const hasSearchQuery = searchValue.length > 0;

  return (
    <PopoverContent
      className="w-[var(--radix-popover-trigger-width)] p-0"
      align="start"
      side="bottom"
    >
      <Command shouldFilter={false}>
        <SearchField
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          isAddingCommand={isAddingCommand}
        />

        <CommandList>
          <CommandGroup>
            {/* Show commands list if there are available commands and not loading */}
            {!loading && hasCommands && (
              <CommandResults
                commands={availableCommands}
                onAddCommand={onAddCommand}
                isAddingCommand={isAddingCommand}
                setOpen={setOpen}
                onSearchChange={onSearchChange}
              />
            )}

            {/* Show appropriate status message */}
            <SearchStatus
              loading={loading}
              hasCommands={hasCommands}
              hasSearchQuery={hasSearchQuery}
              searchValue={searchValue}
            />
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
}
