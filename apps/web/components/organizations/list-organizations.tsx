"use client";

import { useOrganizationsList } from "@/hooks/organization/useOrganizationsList/useOrganizationsList";
import { useLocale } from "@/hooks/useLocale";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { SearchInput } from "@repo/ui/components/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { OrganizationOverviewCards } from "./organization-overview-cards";
import { newOrganizationPath } from "./organization-routes";

/**
 * One listing for both readings of "organizations": the ones the caller belongs to
 * and the public directory. They were two routes and are now one filter, because
 * they answer the same question and differ only in which set is being searched.
 */
export function ListOrganizations() {
  const { t } = useTranslation();
  const {
    filter,
    setFilter,
    search,
    setSearch,
    isSearching,
    debouncedSearch,
    organizations,
    isPending,
    isError,
    isPaged,
    isFetching,
    page,
    setPage,
    offset,
    total,
    isLastPage,
  } = useOrganizationsList();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <SearchInput
          value={search}
          onChange={setSearch}
          isLoading={isSearching}
          placeholder={t("organizations.searchPlaceholder")}
          aria-label={t("organizations.searchLabel")}
          className="w-full md:w-56"
        />
        <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-8">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="md:min-w-45 w-full md:w-auto">
              <SelectValue placeholder={t("organizations.filter.label")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">{t("organizations.filter.my")}</SelectItem>
              <SelectItem value="all">{t("organizations.filter.all")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError ? (
        <p className="text-destructive text-sm">
          {filter === "my"
            ? t("organizations.mine.loadFailed")
            : t("organizations.directory.loadFailed")}
        </p>
      ) : !isPending && organizations.length === 0 ? (
        <EmptyState filter={filter} isSearch={debouncedSearch.trim() !== ""} />
      ) : (
        <>
          <OrganizationOverviewCards organizations={organizations} isPending={isPending} />

          {isPaged && !isPending && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                {t("organizations.directory.showing", {
                  from: offset + 1,
                  to: offset + organizations.length,
                  total,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1 || isFetching}
                >
                  {t("organizations.directory.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={isLastPage || isFetching}
                >
                  {t("organizations.directory.next")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Nothing to show, which is a different thing from nothing matching. */
function EmptyState({ filter, isSearch }: { filter: "my" | "all"; isSearch: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();

  const isMine = filter === "my";

  return (
    <div className="border-border rounded-lg border px-6 py-12 text-center">
      <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
        <Building2 className="h-5 w-5" />
      </div>
      <p className="text-foreground text-sm font-semibold">
        {isSearch
          ? t("organizations.noMatches")
          : isMine
            ? t("organizations.mine.emptyTitle")
            : t("organizations.directory.emptyTitle")}
      </p>
      {!isSearch && (
        <p className="text-muted-foreground mx-auto mt-1 max-w-[380px] text-xs leading-relaxed">
          {isMine ? t("organizations.mine.emptyHint") : t("organizations.directory.emptyHint")}
        </p>
      )}
      {isMine && !isSearch && (
        <Button asChild className="mt-4">
          <Link href={newOrganizationPath(locale)}>
            <Plus className="h-4 w-4" />
            {t("organizations.createAction")}
          </Link>
        </Button>
      )}
    </div>
  );
}
