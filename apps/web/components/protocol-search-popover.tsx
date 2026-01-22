"use client";

import { useLocale } from "@/hooks/useLocale";
import { SearchX, PlusSquare, ExternalLink, Star } from "lucide-react";
import Link from "next/link";
import React, { useCallback } from "react";

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
import { cva } from "@repo/ui/lib/utils";

const protocolItemVariants = cva(
  "mb-1 flex items-center justify-between gap-2 rounded border p-2 relative",
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
    async (e: React.MouseEvent, protocolId: string) => {
      e.stopPropagation();
      await onAddProtocol(protocolId);
      setOpen(false);
      onSearchChange("");
    },
    [onAddProtocol, setOpen, onSearchChange],
  );

  return (
    <>
      {protocols.map((protocol) => {
        const isFeatured = protocol.sortOrder !== null;
        return (
          <CommandItem
            key={protocol.id}
            value={protocol.id}
            className={protocolItemVariants({ featured: isFeatured })}
          >
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              {/* Protocol name */}
              <div className="flex items-center gap-1.5">
                <h4 className="text-foreground truncate text-sm font-medium">{protocol.name}</h4>
                {isFeatured && (
                  <Star className="fill-secondary text-secondary h-3.5 w-3.5 flex-shrink-0" />
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

            <div className="flex flex-col items-center gap-0">
              {/* Add button */}
              <Button
                variant="ghost"
                size="icon"
                className="text-primary hover:bg-accent/40 h-8 w-8 p-0"
                title={t("experiments.addProtocol")}
                onClick={async (e) => handleAddProtocol(e, protocol.id)}
                disabled={isAddingProtocol}
                aria-label={t("experiments.addProtocol")}
              >
                <PlusSquare className="h-5 w-5" />
              </Button>
              {/* CTA button for more details */}
              <Link
                href={`/${locale}/platform/protocols/${protocol.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title={t("experiments.seeProtocolDetails")}
                aria-label={t("experiments.seeProtocolDetails")}
                className="group p-1.5"
              >
                <ExternalLink className="group-hover:text-muted-foreground h-5 w-5 transition-colors" />
              </Link>
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
