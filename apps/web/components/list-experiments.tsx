"use client";

import { ExperimentOverviewCards } from "~/components/experiment-overview-cards";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";

import type { ExperimentStatus } from "@repo/api";
import { zExperimentStatus } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
} from "@repo/ui/components";

export function ListExperiments() {
  const { data, filter, setFilter, status, setStatus, search, setSearch } = useExperiments({});
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
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              style={{ padding: 0, background: "none", border: "none", cursor: "pointer" }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 4L12 12M12 4L4 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
        <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-8">
          <Select
            defaultValue="my"
            value={filter}
            onValueChange={(value: "my" | "member" | "related" | "all") => setFilter(value)}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter experiments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">{t("experiments.filterMy")}</SelectItem>
              <SelectItem value="member">{t("experiments.filterMember")}</SelectItem>
              <SelectItem value="related">{t("experiments.filterRelated")}</SelectItem>
              <SelectItem value="all">{t("experiments.filterAll")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={status ?? "all"}
            onValueChange={(v) => setStatus(v === "all" ? undefined : (v as ExperimentStatus))}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("experiments.filterStatusAll")}</SelectItem>
              {Object.values(zExperimentStatus.enum).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ExperimentOverviewCards experiments={data?.body} />
    </div>
  );
}
