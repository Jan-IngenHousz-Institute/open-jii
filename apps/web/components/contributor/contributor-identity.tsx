"use client";

import { UserAvatar } from "@/components/user-avatar";

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
      <UserAvatar
        avatarUrl={avatar}
        name={name}
        className={isCompact ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-xs"}
      />
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
