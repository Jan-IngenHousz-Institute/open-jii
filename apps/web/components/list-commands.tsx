"use client";

import { X } from "lucide-react";
import React from "react";
import { CommandOverviewCards } from "~/components/command-overview-cards";
import { useCommands } from "~/hooks/command/useCommands/useCommands";

import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

export function ListCommands() {
  const { commands, filter, setFilter, search, setSearch } = useCommands({});
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="relative w-full md:w-[220px]">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("commands.searchCommands")}
            className="w-full pr-8"
          />
          {search && (
            <button
              type="button"
              aria-label={t("commands.clearSearch")}
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-8">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder={t("commands.filterCommands")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">{t("commands.filterMy")}</SelectItem>
              <SelectItem value="all">{t("commands.filterAll")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <CommandOverviewCards commands={commands} />
    </div>
  );
}
