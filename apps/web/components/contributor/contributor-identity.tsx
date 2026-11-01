"use client";

import { personDisplayName } from "@/util/person-display-name";

import { zExperimentDataContributor } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import { cn } from "@repo/ui/lib/utils";

interface ContributorStruct {
  id: string;
  name: string;
  avatar: string | null;
  isGuest?: boolean;
  isFormerGuest?: boolean;
}

interface ContributorIdentityProps {
  data: string | ContributorStruct | null | undefined;
  size?: "default" | "compact";
  className?: string;
}

/**
 * Shared renderer for a CONTRIBUTOR (`STRUCT<id, name, avatar>`). Renders
 * the same shape across data-table cells, filter dropdowns/chips, and
 * dashboard widgets. Server-side pseudonymisation (educational mode)
 * produces `Contributor-XXXXXX` names that flow through unchanged.
 */
export function ContributorIdentity({
  data,
  size = "default",
  className,
}: ContributorIdentityProps) {
  const { t } = useTranslation();
  const struct = parseContributor(data);
  if (!struct) {
    return null;
  }
  const { name, avatar, isGuest, isFormerGuest } = struct;
  if ((!name || name.trim().length === 0) && !isGuest && !isFormerGuest) {
    return null;
  }
  const label = personDisplayName({ firstName: name, isGuest, isFormerGuest }, t);

  const isCompact = size === "compact";
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Avatar className={cn("rounded-full", isCompact ? "h-5 w-5" : "h-6 w-6")}>
        <AvatarImage src={avatar ?? undefined} alt={label} />
        <AvatarFallback className={cn("rounded-full", isCompact ? "text-[10px]" : "text-xs")}>
          {getInitials(label)}
        </AvatarFallback>
      </Avatar>
      <span className={cn("truncate font-medium", isCompact ? "text-xs" : "max-w-[120px] text-sm")}>
        {label}
      </span>
    </div>
  );
}

function parseContributor(
  data: string | ContributorStruct | null | undefined,
): ContributorStruct | null {
  if (data == null) {
    return null;
  }
  try {
    const parsed = zExperimentDataContributor.safeParse(
      typeof data === "string" ? JSON.parse(data) : data,
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
  return null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
