"use client";

import Link from "next/link";

import type { ExperimentContributor } from "@repo/api/domains/experiment/contributors/experiment-contributors.schema";
import { useTranslation } from "@repo/i18n";

import { UserAvatar } from "../user-avatar";

interface ExperimentMembersTrailProps {
  contributors: ExperimentContributor[];
  href: string;
  isLoading?: boolean;
}

const MAX_VISIBLE_AVATARS = 5;

export function ExperimentMembersTrail({
  contributors,
  href,
  isLoading = false,
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

  if (contributors.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("sharing.noCollaboratorsYet")}</p>;
  }

  const visible = contributors.slice(0, MAX_VISIBLE_AVATARS);
  const remainder = contributors.length - visible.length;

  return (
    <Link
      href={href}
      className="hover:bg-muted/50 group -mx-2 flex items-center gap-3 rounded-md px-2 py-1 transition-colors"
    >
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
      <span className="text-muted-foreground group-hover:text-foreground text-sm transition-colors">
        {contributors.length} {t("sharing.collaboratorsTab").toLowerCase()}
      </span>
    </Link>
  );
}
