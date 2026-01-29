"use client";

import { useLocale } from "@/hooks/useLocale";
import { SearchX, ExternalLink } from "lucide-react";
import Link from "next/link";
import React, { useCallback } from "react";

import type { Protocol } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Badge,
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components";
import { PopoverContent } from "@repo/ui/components";
import { cva } from "@repo/ui/lib/utils";

const protocolItemVariants = cva(
  "mb-1 flex items-center justify-between gap-2 rounded border p-2.5 relative",
  {
    variants: {
      featured: {
        true: "border-secondary/30 from-badge-featured bg-gradient-to-br to-white shadow-sm data-[selected=true]:from-badge-featured/80 data-[selected=true]:to-surface",
        false: "border-gray-200 bg-white",
      },
    },
    defaultVariants: {
      featured: false,
    },
  },
);

// Props for the ProtocolList component
interface ProtocolListProps {
  protocols: Protocol[];
  onAddProtocol: (protocolId: string) => Promise<void> | void;
  isAddingProtocol: boolean;
  setOpen: (open: boolean) => void;
  onSearchChange: (value: string) => void;
}

function ProtocolList({
  protocols,
  onAddProtocol,
  isAddingProtocol,
  setOpen,
  onSearchChange,
}: ProtocolListProps) {
  const locale = useLocale();
  const { t } = useTranslation("common");

  const handleAddProtocol = useCallback(
    async (protocolId: string) => {
      await onAddProtocol(protocolId);
      setOpen(false);
      onSearchChange("");
    },
    [onAddProtocol, setOpen, onSearchChange],
  );

  return (
    <>
      {protocols.map((protocol) => {
        const isPreferred = protocol.sortOrder !== null;
        return (
          <CommandItem
            key={protocol.id}
            value={protocol.id}
            className={protocolItemVariants({ featured: isPreferred })}
            onSelect={() => handleAddProtocol(protocol.id)}
            disabled={isAddingProtocol}
          >
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              {/* Protocol name */}
              <div className="mb-1 flex items-center gap-1">
                <h4 className="text-foreground truncate text-sm font-medium">{protocol.name}</h4>

                <Link
                  href={`/${locale}/platform/protocols/${protocol.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t("experiments.seeProtocolDetails")}
                  aria-label={t("experiments.seeProtocolDetails")}
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
                <span className="font-medium">{protocol.family}</span>
              </div>

              {/* Created by */}
              {protocol.createdByName && (
                <div className="text-muted-foreground truncate text-xs">
                  <span className="opacity-75">{t("experiments.createdBy")}</span>{" "}
                  <span className="font-medium">{protocol.createdByName}</span>
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
  hasProtocols: boolean;
  hasSearchQuery: boolean;
  searchValue: string;
}

// Display appropriate message based on search status
function SearchStatus({ loading, hasProtocols, hasSearchQuery, searchValue }: SearchStatusProps) {
  const { t } = useTranslation("common");

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-4 text-sm">
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
        {t("experiments.searchingProtocols")}
      </div>
    );
  }

  if (!hasProtocols && hasSearchQuery) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center py-6 text-sm">
        <SearchX className="mb-2 h-8 w-8" />
        <span className="mb-1 font-medium">{t("experiments.noProtocolsFound")}</span>
        <span className="text-xs">
          {t("experiments.tryDifferentSearchProtocols", { searchValue })}
        </span>
      </div>
    );
  }

  if (!hasProtocols && !hasSearchQuery) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center py-6 text-sm">
        <span className="mb-1 font-medium">{t("experiments.noProtocolsAvailable")}</span>
        <span className="text-xs">{t("experiments.createFirstProtocol")}</span>
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
  const { t } = useTranslation("common");
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
    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
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
