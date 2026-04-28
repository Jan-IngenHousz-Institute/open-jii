"use client";

import { X } from "lucide-react";
import React from "react";
import { MacroOverviewCards } from "~/components/macro-overview-cards";
import { useMacros } from "~/hooks/macro/useMacros/useMacros";

import type { MacroLanguage } from "@repo/api/schemas/macro.schema";
import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

export function ListMacros() {
  const {
    data: macros,
    isLoading,
    filter,
    setFilter,
    search,
    setSearch,
    language,
    setLanguage,
  } = useMacros({});
  const { t } = useTranslation("macro");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="relative w-full md:w-[220px]">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("macros.searchPlaceholder")}
            className="w-full pr-8"
          />
          {search && (
            <button
              type="button"
              aria-label={t("macros.clearSearch")}
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-8">
          <Select
            value={language ?? "all"}
            onValueChange={(value: string) =>
              setLanguage(value === "all" ? undefined : (value as MacroLanguage))
            }
          >
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder={t("macros.filterByLanguage")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("macros.allLanguages")}</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="r">R</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full md:w-[160px]">
              <SelectValue placeholder={t("macros.filterMacros")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">{t("macros.filterMy")}</SelectItem>
              <SelectItem value="all">{t("macros.filterAll")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <MacroOverviewCards macros={macros} isLoading={isLoading} />
    </div>
  );
}
