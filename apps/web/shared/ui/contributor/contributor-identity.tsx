"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import { cn } from "@repo/ui/lib/utils";

interface ContributorStruct {
  id: string;
  name: string;
  avatar: string | null;
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
  const struct = parseContributor(data);
  if (!struct) {
    return null;
  }
  const { name, avatar } = struct;
  if (!name || name.trim().length === 0) {
    return null;
  }

  const isCompact = size === "compact";
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Avatar className={cn("rounded-full", isCompact ? "h-5 w-5" : "h-6 w-6")}>
        <AvatarImage src={avatar ?? undefined} alt={name} />
        <AvatarFallback className={cn("rounded-full", isCompact ? "text-[10px]" : "text-xs")}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <span className={cn("truncate font-medium", isCompact ? "text-xs" : "max-w-[120px] text-sm")}>
        {name}
      </span>
    </div>
  );
}

function isContributorStruct(value: unknown): value is ContributorStruct {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("id" in value) || !("name" in value) || !("avatar" in value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.avatar === null || typeof value.avatar === "string")
  );
}

function parseContributor(
  data: string | ContributorStruct | null | undefined,
): ContributorStruct | null {
  if (data == null) {
    return null;
  }
  if (typeof data === "object") {
    return isContributorStruct(data) ? data : null;
  }
  try {
    const parsed: unknown = JSON.parse(data);
    if (isContributorStruct(parsed)) {
      return parsed;
    }
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
