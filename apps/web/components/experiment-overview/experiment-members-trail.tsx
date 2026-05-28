"use client";

import Link from "next/link";

import type { ExperimentMember } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

import { UserAvatar } from "../user-avatar";

interface ExperimentMembersTrailProps {
  members: ExperimentMember[];
  href: string;
  isLoading?: boolean;
}

const MAX_VISIBLE_AVATARS = 5;

export function ExperimentMembersTrail({
  members,
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

  if (members.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("experimentSettings.noMembers")}</p>;
  }

  const visible = members.slice(0, MAX_VISIBLE_AVATARS);
  const remainder = members.length - visible.length;

  return (
    <Link
      href={href}
      className="hover:bg-muted/50 group -mx-2 flex items-center gap-3 rounded-md px-2 py-1 transition-colors"
    >
      <div className="flex -space-x-2">
        {visible.map((member) => (
          <UserAvatar
            key={member.user.id}
            avatarUrl={member.user.avatarUrl}
            firstName={member.user.firstName}
            lastName={member.user.lastName}
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
        {members.length} {t("experimentSettings.membersTab").toLowerCase()}
      </span>
    </Link>
  );
}
