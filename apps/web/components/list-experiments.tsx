"use client";

import { X } from "lucide-react";
import { ExperimentOverviewCards } from "~/components/experiment-overview-cards";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";

import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
} from "@repo/ui/components";

interface ListExperimentsProps {
  archived?: boolean;
}

export function ListExperiments({ archived = false }: ListExperimentsProps) {
  const { data, filter, setFilter, search, setSearch } = useExperiments({
    archived,
  });
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="relative w-full md:w-[220px]">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("experiments.searchExperiments")}
            className="w-full pr-8"
          />
          {search && (
            <button
              type="button"
              aria-label={t("experiments.clearSearch")}
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
              <SelectValue placeholder="Filter experiments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">{t("experiments.filterMember")}</SelectItem>
              <SelectItem value="all">{t("experiments.filterAll")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ExperimentOverviewCards experiments={data?.body} archived={archived} />
    </div>
  );
}
