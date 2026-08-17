"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime, formatShortDate } from "@/util/date";
import { getExperimentStatusBadgeColor } from "@/util/experiment-status";
import { getMacroLanguageBadgeColor, getMacroLanguageLabel } from "@/util/macro-language";
import { getSensorFamilyBadgeColor, getSensorFamilyLabel } from "@/util/sensor-family";
import { stripHtml } from "@/util/strip-html";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { OrganizationResource } from "@repo/api/domains/organization/organization.schema";
import type { TransferableResourceType } from "@repo/api/domains/sharing/transfer-org/sharing-transfer-org.schema";
import { zTransferableResourceType } from "@repo/api/domains/sharing/transfer-org/sharing-transfer-org.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { SearchInput } from "@repo/ui/components/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

import type { ResourceSort, ResourceTypeFilter } from "./organization-resource-filter";
import {
  DEFAULT_RESOURCE_FILTER,
  filterAndSortResources,
  hasActiveFilters,
} from "./organization-resource-filter";
import { GROUP_ORDER, RESOURCE_SEGMENT, RESOURCE_TYPE_COLOR } from "./organization-resource-meta";
import { ResourceTransferDialog } from "./resource-transfer-dialog";

/** The sort options, in the order they are offered. */
const SORT_OPTIONS: readonly { value: ResourceSort; labelKey: string }[] = [
  { value: "recent", labelKey: "organizations.resources.sortRecent" },
  { value: "name", labelKey: "organizations.resources.sortName" },
  { value: "type", labelKey: "organizations.resources.sortType" },
];

/** Read off the schema rather than excluding `device` by hand, so a sixth type stays honest. */
function transferableType(type: OrganizationResource["type"]): TransferableResourceType | null {
  const parsed = zTransferableResourceType.safeParse(type);
  return parsed.success ? parsed.data : null;
}

/** A row's one type-specific fact, in the colour that value wears on its own listing. */
function metaBadge(
  resource: OrganizationResource,
  t: (key: string) => string,
): { label: string; colorClass: string } | null {
  switch (resource.type) {
    case "experiment":
      return {
        label: t(`organizations.resources.status.${resource.status}`),
        colorClass: getExperimentStatusBadgeColor(resource.status),
      };
    case "protocol":
      return {
        label: getSensorFamilyLabel(resource.family),
        colorClass: getSensorFamilyBadgeColor(resource.family),
      };
    case "macro":
      return {
        label: getMacroLanguageLabel(resource.language),
        colorClass: getMacroLanguageBadgeColor(resource.language),
      };
    case "device":
      return {
        label: getSensorFamilyLabel(resource.deviceType),
        colorClass: getSensorFamilyBadgeColor(resource.deviceType),
      };
    case "workbook":
      return null;
  }
}

/** The resource a transfer is being started for, held by the list rather than by its row. */
interface TransferTarget {
  type: TransferableResourceType;
  id: string;
}

/**
 * Everything the organization owns that the caller can open, as one filtered list. The
 * type options and the type sort come off {@link GROUP_ORDER}, so neither can drift from
 * the featured card or the estate bar.
 *
 * `transfer` carries the capability and the organization together, so the affordance
 * cannot be offered without somewhere to move a resource out of. Absent means nobody.
 */
export function OrganizationResourceRows({
  resources,
  transfer,
}: {
  resources: OrganizationResource[];
  transfer?: { organizationId: string };
}) {
  const { t } = useTranslation();

  const [query, setQuery] = useState(DEFAULT_RESOURCE_FILTER.query);
  const [type, setType] = useState<ResourceTypeFilter>(DEFAULT_RESOURCE_FILTER.type);
  const [sort, setSort] = useState<ResourceSort>(DEFAULT_RESOURCE_FILTER.sort);
  const [target, setTarget] = useState<TransferTarget | null>(null);

  // The read is uncapped, so without this it re-runs over everything on every keystroke.
  const visible = useMemo(
    () => filterAndSortResources(resources, { query, type, sort }),
    [resources, query, type, sort],
  );

  // Sort is not reset: it arranges rather than narrows.
  const clearFilters = () => {
    setQuery(DEFAULT_RESOURCE_FILTER.query);
    setType(DEFAULT_RESOURCE_FILTER.type);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t("organizations.resources.searchPlaceholder")}
            aria-label={t("organizations.resources.searchLabel")}
            className="sm:flex-1"
          />

          <Select value={type} onValueChange={(next) => setType(next as ResourceTypeFilter)}>
            <SelectTrigger
              className="w-full sm:w-40"
              aria-label={t("organizations.resources.typeFilterLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("organizations.resources.allTypes")}</SelectItem>
              {GROUP_ORDER.map((resourceType) => (
                <SelectItem key={resourceType} value={resourceType}>
                  {t(`organizations.resources.types.${resourceType}`, { count: 2 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(next) => setSort(next as ResourceSort)}>
            <SelectTrigger
              className="w-full sm:w-44"
              aria-label={t("organizations.resources.sortLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {visible.length === 0 ? (
          <div className="border-border border-t py-10 text-center">
            <p className="text-foreground text-sm font-semibold">
              {t("organizations.resources.noMatchesTitle")}
            </p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-[320px] text-xs leading-relaxed">
              {t("organizations.resources.noMatchesHint")}
            </p>
            {/* A reset that resets nothing is a dead control. */}
            {hasActiveFilters({ query, type, sort }) ? (
              <Button variant="outline" size="sm" className="mt-3.5" onClick={clearFilters}>
                {t("organizations.resources.clearFilters")}
              </Button>
            ) : null}
          </div>
        ) : (
          <ul
            role="list"
            aria-label={t("organizations.resources.title")}
            className="border-border border-t"
          >
            {visible.map((resource) => (
              <ResourceRow
                key={`${resource.type}-${resource.id}`}
                resource={resource}
                onTransfer={transfer ? setTarget : null}
              />
            ))}
          </ul>
        )}

        {/* One dialog, not one per row: it reads the caller's memberships when it opens. */}
        {transfer && target ? (
          <ResourceTransferDialog
            resourceType={target.type}
            resourceId={target.id}
            currentOrganizationId={transfer.organizationId}
            open
            onOpenChange={(next) => {
              if (!next) setTarget(null);
            }}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function ResourceRow({
  resource,
  onTransfer,
}: {
  resource: OrganizationResource;
  onTransfer: ((target: TransferTarget) => void) | null;
}) {
  const { t } = useTranslation();
  const locale = useLocale();

  const meta = metaBadge(resource, t);
  // A device has no transfer route, so it gets no control rather than one that refuses.
  const transferableAs = onTransfer ? transferableType(resource.type) : null;

  return (
    <li className="border-border/60 border-b py-3 last:border-b-0">
      <span className="flex min-w-0 items-center gap-1.5">
        <Link
          href={`/${locale}/platform/${RESOURCE_SEGMENT[resource.type]}/${resource.id}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {resource.name}
        </Link>
        {/* Private only: public is the default, so marking it would be noise. */}
        {resource.visibility === "private" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="text-muted-foreground shrink-0"
                aria-label={t("resourceVisibility.privateStatus")}
              >
                <Lock className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("organizations.resources.privateTooltip")}</TooltipContent>
          </Tooltip>
        ) : null}

        {onTransfer && transferableAs ? (
          <Button
            variant="buttonLink"
            className="ml-auto h-auto shrink-0 p-0"
            // Named for its row: every one of these reads "Transfer" otherwise.
            aria-label={t("organizations.transfer.actionFor", { name: resource.name })}
            onClick={() => onTransfer({ type: transferableAs, id: resource.id })}
          >
            {t("organizations.transfer.action")}
          </Button>
        ) : null}
      </span>

      {/* Stripped, not rendered: a rich-editor description interpolated raw prints
          literal `<p>`. A device has no such column, hence the guard. */}
      {resource.description ? (
        <p className="text-muted-foreground mt-1 truncate text-xs">
          {stripHtml(resource.description)}
        </p>
      ) : null}

      <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${RESOURCE_TYPE_COLOR[resource.type]}`}
            aria-hidden
          />
          {t(`organizations.resources.types.${resource.type}`, { count: 1 })}
        </span>

        {meta ? (
          <Badge className={`shrink-0 rounded px-1.5 py-0 font-medium ${meta.colorClass}`}>
            {meta.label}
          </Badge>
        ) : null}

        {/* One string, so the space survives a wrap. The absolute date rides as the
            title, since a relative time alone cannot be cited. */}
        <time
          dateTime={resource.updatedAt}
          title={`${t("common.updated")} ${formatShortDate(resource.updatedAt, locale)}`}
          className="shrink-0 sm:ml-auto"
        >
          {`${t("common.updated")} ${formatRelativeTime(resource.updatedAt, locale)}`}
        </time>
      </div>
    </li>
  );
}
