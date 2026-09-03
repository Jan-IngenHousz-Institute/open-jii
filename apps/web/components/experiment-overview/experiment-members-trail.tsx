"use client";

import Link from "next/link";

import type { ExperimentContributor } from "@repo/api/domains/experiment/contributors/experiment-contributors.schema";
import { useTranslation } from "@repo/i18n";

import { UserAvatar } from "../user-avatar";

interface ExperimentMembersTrailProps {
  /**
   * The faces to show — grant holders only, pseudonymised where the experiment says
   * so. Deliberately a narrower set than {@link collaboratorCount}, since naming who
   * holds access needs `can(share)` and a headcount does not.
   */
  contributors: ExperimentContributor[];
  /** Every row the collaborators surface would list; the number this trail states. */
  collaboratorCount: number;
  href: string;
  isLoading?: boolean;
  /** The read failed, so the count is unknown rather than zero. */
  isError?: boolean;
}

const MAX_VISIBLE_AVATARS = 5;

/**
 * An avatar sample plus an authoritative total, which do not have to agree: an
 * organization-owned experiment has collaborators whose access is their org role, and
 * they have no face to show here. So the total drives the label and the remainder,
 * and the faces are whatever may be credited.
 */
export function ExperimentMembersTrail({
  contributors,
  collaboratorCount,
  href,
  isLoading = false,
  isError = false,
}: ExperimentMembersTrailProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="ring-background bg-muted h-6 w-6 animate-pulse rounded-full ring-2"
            />
          ))}
        </div>
      </div>
    );
  }

  // Checked before the zero: a failed read has no count, and rendering "none yet"
  // would state as fact something the server never answered.
  if (isError) {
    return <p className="text-destructive text-sm">{t("sharing.loadFailed")}</p>;
  }

  // The count, not the faces, decides whether there is anything here: an org-owned
  // experiment can have collaborators and no creditable contributor among them.
  if (collaboratorCount === 0) {
    return <p className="text-muted-foreground text-sm">{t("sharing.noCollaboratorsYet")}</p>;
  }

  const visible = contributors.slice(0, MAX_VISIBLE_AVATARS);
  // Clamped: the two sets are computed apart, and a "+-1" bubble is worse than none.
  const remainder = Math.max(0, collaboratorCount - visible.length);

  return (
    <Link
      href={href}
      className="hover:bg-muted/50 group -mx-2 flex items-center gap-3 rounded-md px-2 py-1 transition-colors"
    >
      {/* No stack at all when nothing may be credited: a lone "+3" bubble beside no
          faces reads as three hidden people rather than as the total. */}
      {visible.length > 0 && (
        <div className="flex -space-x-2">
          {visible.map((contributor) => (
            <UserAvatar
              key={contributor.userId}
              avatarUrl={contributor.avatarUrl}
              firstName={contributor.firstName}
              lastName={contributor.lastName}
              className="ring-background bg-muted h-6 w-6 text-[10px] ring-2"
            />
          ))}
          {remainder > 0 && (
            <div className="ring-background bg-muted text-muted-foreground flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ring-2">
              +{remainder}
            </div>
          )}
        </div>
      )}
      <span className="text-muted-foreground group-hover:text-foreground text-sm transition-colors">
        {t("sharing.collaboratorCount", { count: collaboratorCount })}
      </span>
    </Link>
  );
}
