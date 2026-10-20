"use client";

import { RESOURCE_SEGMENT } from "@/components/organizations/organization-resource-meta";
import { useLocale } from "@/hooks/useLocale";
import { useRememberedValue } from "@/hooks/useRememberedValue";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { RelatedHomeExperiment } from "@repo/api/domains/experiment/experiment.schema";
import { zVisitedResourceType } from "@repo/api/domains/visit/visit.schema";
import type { RecentlyOpenedResource } from "@repo/api/domains/visit/visit.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import {
  READ_EACH_VISIT,
  RECENTLY_OPENED_LIMIT,
  homeExperimentsQuery,
  recentlyOpenedQuery,
} from "./dashboard-queries";
import { DashboardSection } from "./dashboard-section";
import { RecentlyOpenedChips } from "./recently-opened-chips";
import { RecentlyOpenedRow } from "./recently-opened-row";
import { SeeAllLink } from "./see-all-link";

const PICKED_TYPE_KEY = "openjii.home.recentlyOpenedType";

/**
 * The reader's newest visits of every type, narrowed by chip to one. Before the first visit
 * it shows their related experiments instead, and with neither it renders nothing.
 */
export function RecentlyOpenedSection() {
  const { t } = useTranslation();
  const locale = useLocale();
  const picked = useRememberedValue(PICKED_TYPE_KEY);

  const all = useQuery({ ...recentlyOpenedQuery(orpc), ...READ_EACH_VISIT });
  const related = useQuery({ ...homeExperimentsQuery(orpc), ...READ_EACH_VISIT });

  const types = all.data?.types ?? [];
  const requested = zVisitedResourceType.safeParse(picked.value);
  // A remembered type with no visits left falls back to All.
  const type = requested.success && types.includes(requested.data) ? requested.data : null;

  const narrowed = useQuery({
    ...recentlyOpenedQuery(orpc, type ?? undefined),
    ...READ_EACH_VISIT,
    enabled: type !== null,
  });

  const pickType = (value: string) => {
    // A single toggle group reports "" when its pressed item is pressed again.
    if (value) picked.remember(value);
  };

  const renderOpened = (resource: RecentlyOpenedResource) => (
    <RecentlyOpenedRow
      key={`${resource.type}-${resource.id}`}
      resource={resource}
      at={resource.openedAt}
      kind="opened"
    />
  );

  const renderRelated = (experiment: RelatedHomeExperiment) => (
    <RecentlyOpenedRow
      key={experiment.id}
      resource={{
        type: "experiment",
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
        organizationName: experiment.organizationName ?? null,
        callerRole: experiment.callerRole,
      }}
      at={experiment.updatedAt}
      kind="updated"
    />
  );

  const retryAll = () => void all.refetch();
  const retryRelated = () => void related.refetch();
  const retryNarrowed = () => void narrowed.refetch();

  const frame = (title: string, action: ReactNode, body: ReactNode) => (
    <DashboardSection id="recently-opened" title={title} action={action}>
      {body}
    </DashboardSection>
  );

  const renderFailure = (message: string, onRetry: () => void) => (
    <div
      role="alert"
      className="border-border text-muted-foreground flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-4 text-center text-sm"
    >
      <p>{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("errors.tryAgain")}
      </Button>
    </div>
  );

  const loadingRows = (
    <div aria-busy="true" className="flex flex-col gap-3">
      {Array.from({ length: RECENTLY_OPENED_LIMIT }).map((_, index) => (
        <Skeleton key={index} className="h-11" />
      ))}
    </div>
  );

  // Before the first visit. A failed read says so: an empty section would read as no work.
  const renderRelatedFallback = () => {
    const title = t("dashboard.yourExperiments");

    if (related.isError) {
      return frame(
        title,
        null,
        renderFailure(t("dashboard.userExperimentsLoadFailed"), retryRelated),
      );
    }
    if (related.isPending) return frame(title, null, loadingRows);
    if (related.data.experiments.length === 0) return null;

    return frame(
      title,
      <SeeAllLink href={`/${locale}/platform/experiments`}>{t("dashboard.seeAll")}</SeeAllLink>,
      <ul role="list" className="border-border border-t">
        {related.data.experiments.map(renderRelated)}
      </ul>,
    );
  };

  if (all.isError) {
    return frame(
      t("dashboard.recentlyOpened"),
      null,
      renderFailure(t("dashboard.recentlyOpenedLoadFailed"), retryAll),
    );
  }

  if (all.isPending) return frame(t("dashboard.recentlyOpened"), null, loadingRows);

  if (types.length === 0) return renderRelatedFallback();

  // Until the narrowed read lands, the type's rows among All stand in for it.
  const rows = type
    ? (narrowed.data?.items ?? all.data.items.filter((item) => item.type === type))
    : all.data.items;
  const hasChips = types.length > 1;
  const hasNarrowedFailed = type !== null && narrowed.isError;
  const seeAll = type ? (
    <SeeAllLink href={`/${locale}/platform/${RESOURCE_SEGMENT[type]}`}>
      {t(`dashboard.seeAllType.${type}`)}
    </SeeAllLink>
  ) : null;

  return frame(
    t("dashboard.recentlyOpened"),
    seeAll,
    <div className="flex min-w-0 flex-col gap-3">
      {hasChips ? <RecentlyOpenedChips types={types} value={type} onChange={pickType} /> : null}
      {hasNarrowedFailed ? (
        renderFailure(t("dashboard.recentlyOpenedLoadFailed"), retryNarrowed)
      ) : (
        <ul
          role="list"
          aria-busy={type !== null && narrowed.isPending}
          className="border-border border-t"
        >
          {rows.map(renderOpened)}
        </ul>
      )}
    </div>,
  );
}
