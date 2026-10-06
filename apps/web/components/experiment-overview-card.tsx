"use client";

import { ResourceCard } from "@/components/shared/resource-card";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { formatDateTime, formatRelativeTime, formatShortDate } from "@/util/date";
import { Building2, Users } from "lucide-react";

import type {
  ExperimentCallerRole,
  ExperimentListItem,
} from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";

/** When the caller last opened the experiment, and the role they hold on it. */
export interface ExperimentVisit {
  openedAt: string;
  callerRole: ExperimentCallerRole | null;
}

/** True for any card in the set, so the reserved badge row is never dead space. */
export function hasBadges(experiment: ExperimentListItem, visit?: ExperimentVisit): boolean {
  return (
    experiment.visibility === "private" ||
    Boolean(experiment.organizationName) ||
    Boolean(visit?.callerRole)
  );
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
  showUpdatedLabel?: boolean;
  /** Shows the caller's role and when they opened it, in place of the update date. */
  visit?: ExperimentVisit;
}

/** Renders a linked experiment summary with badges, owner, member count, and an update or opened date. */
export function ExperimentOverviewCard({
  experiment,
  href,
  locale,
  reserveBadgeRow,
  showUpdatedLabel = false,
  visit,
}: ExperimentOverviewCardProps) {
  const { t } = useTranslation("experiments");
  const { t: tCommon } = useTranslation();

  const owner = ownerName(experiment);
  const updated = formatShortDate(experiment.updatedAt, locale);
  const members = experiment.membersCount ?? 0;

  const renderBadges = () => (
    <>
      {visit?.callerRole ? (
        <Badge variant="outline" className="font-normal">
          {tCommon(`organizations.roles.${visit.callerRole}`)}
        </Badge>
      ) : null}
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
        {visit ? (
          <span className="tabular-nums" title={formatDateTime(visit.openedAt, locale)}>
            {t("openedOn", { when: formatRelativeTime(visit.openedAt, locale) })}
          </span>
        ) : (
          <span className="tabular-nums" title={t("columns.updated")}>
            {showUpdatedLabel ? t("updatedOn", { date: updated }) : updated}
          </span>
        )}
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
