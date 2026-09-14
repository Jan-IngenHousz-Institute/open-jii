"use client";

import { ResourceCard } from "@/components/shared/resource-card";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { formatShortDate } from "@/util/date";
import { Building2, Users } from "lucide-react";

import type { ExperimentListItem } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";

/** True for any card in the set, so the reserved badge row is never dead space. */
export function hasBadges(experiment: ExperimentListItem): boolean {
  return experiment.visibility === "private" || Boolean(experiment.organizationName);
}

function ownerName(experiment: ExperimentListItem): string {
  return [experiment.ownerFirstName, experiment.ownerLastName].filter(Boolean).join(" ");
}

interface ExperimentOverviewCardProps {
  experiment: ExperimentListItem;
  href: string;
  locale: string;
  /** Set by the grid, so titles line up across cards whose badges differ. */
  reserveBadgeRow: boolean;
}

export function ExperimentOverviewCard({
  experiment,
  href,
  locale,
  reserveBadgeRow,
}: ExperimentOverviewCardProps) {
  const { t } = useTranslation("experiments");

  const owner = ownerName(experiment);
  const members = experiment.membersCount ?? 0;

  const renderBadges = () => (
    <>
      {experiment.organizationName ? (
        <Badge variant="secondary" className="max-w-full gap-1 font-normal">
          <Building2 className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{experiment.organizationName}</span>
        </Badge>
      ) : null}
      <VisibilityBadge visibility={experiment.visibility} privateOnly />
    </>
  );

  const renderOwner = () => (
    <span className="flex min-w-0 items-center gap-1.5" title={`${t("columns.owner")}: ${owner}`}>
      <Avatar className="size-5 shrink-0">
        <AvatarFallback className="text-[9px] font-medium">
          {owner.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{owner}</span>
    </span>
  );

  const renderFooter = () => (
    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      {owner === "" ? <span /> : renderOwner()}
      <span className="flex shrink-0 items-center gap-3">
        {members > 0 ? (
          <span className="inline-flex items-center gap-1" title={t("columns.members")}>
            <Users className="size-3.5 shrink-0" aria-hidden />
            <span className="tabular-nums">{members}</span>
          </span>
        ) : null}
        <span className="tabular-nums" title={t("columns.updated")}>
          {formatShortDate(experiment.updatedAt, locale)}
        </span>
      </span>
    </span>
  );

  return (
    <ResourceCard
      href={href}
      title={experiment.name}
      badges={reserveBadgeRow ? renderBadges() : undefined}
      footer={renderFooter()}
    >
      <RichTextRenderer content={experiment.description ?? " "} truncate maxLines={2} />
    </ResourceCard>
  );
}
