"use client";

import { useLocale } from "@/hooks/useLocale";
import { SearchX, PlusSquare, ExternalLink } from "lucide-react";
import React from "react";

import type { Protocol } from "@repo/api";
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

// Props for the ProtocolList component
interface ProtocolListProps {
  protocols: Protocol[];
  onAddProtocol: (protocolId: string) => Promise<void> | void;
  isAddingProtocol: boolean;
  setOpen: (open: boolean) => void;
  onSearchChange: (value: string) => void;
}

// Display a list of protocol items with add buttons
function ProtocolList({
  protocols,
  onAddProtocol,
  isAddingProtocol,
  setOpen,
  onSearchChange,
}: ProtocolListProps) {
  const locale = useLocale();
  const { t } = useTranslation(undefined, "common");

  return (
    <>
      {protocols.map((protocol) => (
        <CommandItem
          key={protocol.id}
          value={protocol.id}
          className="mb-2 flex items-center justify-between gap-3 rounded border"
        >
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            {/* Protocol name */}
            <div className="mb-1 flex items-center">
              <h4 className="text-foreground flex-1 truncate text-sm font-medium">
                {protocol.name}
              </h4>
            </div>

            {/* Family */}
            <div className="text-muted-foreground truncate text-xs">
              <span className="opacity-75">{t("experiments.family")}</span>{" "}
              <span className="font-medium">{protocol.family}</span>
            </div>

            {/* Created by */}
            {protocol.createdBy && (
              <div className="text-muted-foreground truncate text-xs">
                <span className="opacity-75">{t("experiments.createdBy")}</span>{" "}
                <span className="font-medium">{protocol.createdBy}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-0">
            {/* Add button */}
            <Button
              variant="ghost"
              size="icon"
              className="text-primary hover:bg-accent/40 mt-1 p-0"
              title={t("experiments.addProtocol")}
              onClick={async (e) => {
                e.stopPropagation();
                await onAddProtocol(protocol.id);
                setOpen(false);
                onSearchChange("");
              }}
              disabled={isAddingProtocol}
              aria-label={t("experiments.addProtocol")}
            >
              <PlusSquare className="h-6 w-6" />
            </Button>
            {/* CTA button for more details */}
            <Button
              variant="ghost"
              size="icon"
              title={t("experiments.seeProtocolDetails")}
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/${locale}/platform/protocols/${protocol.id}`, "_blank");
              }}
              aria-label={t("experiments.seeProtocolDetails")}
            >
              <ExternalLink className="h-6 w-6" />
            </Button>
          </div>
        </CommandItem>
      ))}
    </>
  );
}

// Props for the SearchStatus component
interface SearchStatusProps {
  loading: boolean;
  hasProtocols: boolean;
  hasSearchQuery: boolean;
  searchValue: string;
}

// Display appropriate message based on search status
function SearchStatus({ loading, hasProtocols, hasSearchQuery, searchValue }: SearchStatusProps) {
  const { t } = useTranslation(undefined, "common");

  if (loading) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        {t("experiments.loadingProtocols")}
      </div>
    );
  }

  if (!hasProtocols && hasSearchQuery) {
    return (
      <CommandEmpty>{t("experiments.noProtocolsFoundFor", { search: searchValue })}</CommandEmpty>
    );
  }

  if (!hasProtocols && !hasSearchQuery) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        {t("experiments.noProtocolsAvailable")}
      </div>
    );
  }

  return null;
}

// Search field component with clear button
interface SearchFieldProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  isAddingProtocol: boolean;
}

function SearchField({ searchValue, onSearchChange, isAddingProtocol }: SearchFieldProps) {
  const { t } = useTranslation(undefined, "common");
  return (
    <div className="relative w-full">
      <CommandInput
        placeholder={t("experiments.searchProtocols")}
        value={searchValue}
        onValueChange={onSearchChange}
        disabled={isAddingProtocol}
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

export interface ProtocolSearchPopoverProps {
  availableProtocols: Protocol[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddProtocol: (protocolId: string) => Promise<void> | void;
  isAddingProtocol: boolean;
  loading: boolean;
  setOpen: (open: boolean) => void;
}

export function ProtocolSearchPopover({
  availableProtocols,
  searchValue,
  onSearchChange,
  onAddProtocol,
  isAddingProtocol,
  loading,
  setOpen,
}: ProtocolSearchPopoverProps) {
  const hasProtocols = availableProtocols.length > 0;
  const hasSearchQuery = searchValue.length > 0;

  return (
    <PopoverContent className="box-border w-auto min-w-40 max-w-60 p-0">
      <Command shouldFilter={false}>
        <SearchField
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          isAddingProtocol={isAddingProtocol}
        />

        <CommandList>
          <CommandGroup>
            {/* Show protocols list if there are available protocols and not loading */}
            {!loading && hasProtocols && (
              <ProtocolList
                protocols={availableProtocols}
                onAddProtocol={onAddProtocol}
                isAddingProtocol={isAddingProtocol}
                setOpen={setOpen}
                onSearchChange={onSearchChange}
              />
            )}

            {/* Show appropriate status message */}
            <SearchStatus
              loading={loading}
              hasProtocols={hasProtocols}
              hasSearchQuery={hasSearchQuery}
              searchValue={searchValue}
            />
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
}
