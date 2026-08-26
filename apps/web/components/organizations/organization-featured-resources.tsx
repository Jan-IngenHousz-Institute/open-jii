"use client";

import { useLocale } from "@/hooks/useLocale";
import { stripHtml } from "@/util/strip-html";
import { Lock, Users } from "lucide-react";
import Link from "next/link";

import type { OrganizationResource } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

import { pickFeaturedResources } from "./organization-featured-selection";
import { RESOURCE_SEGMENT, RESOURCE_TYPE_COLOR } from "./organization-resource-meta";

/**
 * The six resources worth opening first — see {@link pickFeaturedResources} for what
 * earns a slot. Nothing when the organization has none; the resources card below
 * already carries the empty state.
 *
 * Selected here rather than server-side: the showcase read is uncapped and every row is
 * already in hand, so a second endpoint would be a second definition of the same
 * ranking, free to disagree with the list underneath.
 */
export function OrganizationFeaturedResources({
  resources,
}: {
  resources: OrganizationResource[];
}) {
  const { t } = useTranslation();

  const featured = pickFeaturedResources(resources);
  if (featured.length === 0) return null;

  return (
    <TooltipProvider>
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          {t("organizations.featured.title")}
        </h2>

        <ul
          role="list"
          aria-label={t("organizations.featured.title")}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {featured.map((resource) => (
            <FeaturedResourceCard key={`${resource.type}-${resource.id}`} resource={resource} />
          ))}
        </ul>
      </section>
    </TooltipProvider>
  );
}

function FeaturedResourceCard({ resource }: { resource: OrganizationResource }) {
  const { t } = useTranslation();
  const locale = useLocale();

  return (
    <li className="flex">
      <Link
        href={`/${locale}/platform/${RESOURCE_SEGMENT[resource.type]}/${resource.id}`}
        className="flex flex-1"
      >
        <Card interactive className="flex-1 gap-2 p-4">
          <div className="flex items-start justify-between gap-2.5">
            <span className="text-primary min-w-0 break-words text-sm font-semibold">
              {resource.name}
            </span>
            {/* The lock, not a "Public" badge on everything — as the resources card does. */}
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
          </div>

          {/* Tags stripped, not rendered: a description is authored in a rich editor, so
            interpolating it raw prints literal `<p>` markup. Placeholder rather than
            nothing, so a device — which has no description column — keeps the card's
            height instead of reading as a shorter card in the grid. */}
          {resource.description ? (
            <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
              {stripHtml(resource.description)}
            </p>
          ) : (
            <p className="text-muted-foreground/70 text-xs italic leading-relaxed">
              {t("organizations.resources.noDescription")}
            </p>
          )}

          <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
            <span className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${RESOURCE_TYPE_COLOR[resource.type]}`}
                aria-hidden
              />
              {t(`organizations.resources.types.${resource.type}`, { count: 1 })}
            </span>
            {/* Spelled out rather than bare: "5" beside a person glyph is a guess. */}
            <span className="flex items-center gap-1.5">
              <Users className="h-3 w-3 shrink-0" aria-hidden />
              {t("organizations.featured.collaboratorCount", { count: resource.collaboratorCount })}
            </span>
          </div>
        </Card>
      </Link>
    </li>
  );
}
