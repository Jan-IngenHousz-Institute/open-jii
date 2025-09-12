"use client";

import React, { useState } from "react";
import { MacroOverviewCards } from "~/components/macro-overview-cards";
import { useMacros } from "~/hooks/macro/useMacros/useMacros";

import { useTranslation } from "@repo/i18n";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

export function ListMacros() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<string | undefined>(undefined);
  const { t } = useTranslation();

  const {
    data: macros,
    isLoading,
    error,
  } = useMacros({
    search: search || undefined,
    language: language as "python" | "r" | "javascript" | undefined,
  });

  if (error) {
    return <div className="text-red-600">{t("macros.errorLoading")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Select
          value={language ?? "all"}
          onValueChange={(value: string) => setLanguage(value === "all" ? undefined : value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("macros.filterByLanguage")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("macros.allLanguages")}</SelectItem>
            <SelectItem value="python">Python</SelectItem>
            <SelectItem value="r">R</SelectItem>
            <SelectItem value="javascript">JavaScript</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder={t("macros.searchPlaceholder")}
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="w-[300px]"
        />
      </div>

      <MacroOverviewCards macros={macros} isLoading={isLoading} />
    </div>
  );
}
