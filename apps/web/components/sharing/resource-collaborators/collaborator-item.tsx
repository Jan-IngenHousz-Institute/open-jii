"use client";

import { Building2, Mail, Users } from "lucide-react";

import type { GranteeTypeValue } from "@repo/api/schemas/sharing.schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";

import { UserAvatar } from "../../user-avatar";

export interface CollaboratorGrant {
  id: string;
  role: string;
  granteeType: GranteeTypeValue;
  granteeId: string;
  grantee: {
    type: GranteeTypeValue;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
}

interface CollaboratorItemProps {
  grant: CollaboratorGrant;
  canShare: boolean;
  isUpdating: boolean;
  onValueChange: (value: string) => void;
}

const SUBTITLE: Record<GranteeTypeValue, string> = {
  user: "Person",
  organization: "Organization",
  team: "Team",
};

function splitName(displayName: string): [string, string] {
  const parts = displayName.trim().split(/\s+/);
  return [parts[0] ?? "", parts.length > 1 ? parts[parts.length - 1] : ""];
}

/** One row in the collaborators list: a user, org, or team granted access. */
export function CollaboratorItem({
  grant,
  canShare,
  isUpdating,
  onValueChange,
}: CollaboratorItemProps) {
  const name = grant.grantee.displayName ?? grant.granteeId;
  const subtitle =
    grant.granteeType === "user"
      ? (grant.grantee.email ?? SUBTITLE.user)
      : SUBTITLE[grant.granteeType];
  const isOwner = grant.role === "owner";

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {grant.granteeType === "user" ? (
        <UserAvatar
          avatarUrl={grant.grantee.avatarUrl}
          firstName={splitName(name)[0]}
          lastName={splitName(name)[1]}
          className="h-9 w-9"
        />
      ) : (
        <div className="bg-primary/10 text-primary grid h-9 w-9 shrink-0 place-items-center rounded-full">
          {grant.granteeType === "organization" ? (
            <Building2 className="h-4 w-4" />
          ) : (
            <Users className="h-4 w-4" />
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <h4 className="text-foreground truncate text-sm font-medium" title={name}>
          {name}
        </h4>
        <span className="flex min-w-0 items-center gap-x-1">
          {grant.granteeType === "user" && (
            <Mail className="text-muted-foreground h-3 w-3 flex-shrink-0" />
          )}
          <span className="text-muted-foreground truncate text-xs" title={subtitle}>
            {subtitle}
          </span>
        </span>
      </div>

      <div className="flex flex-shrink-0">
        {canShare && !isOwner ? (
          <Select value={grant.role} disabled={isUpdating} onValueChange={onValueChange}>
            <SelectTrigger className="w-[110px]" aria-label={`Role for ${name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
              <div className="my-1 border-t" />
              <SelectItem
                value="remove"
                className="text-destructive focus:text-destructive"
                aria-label={`Remove access for ${name}`}
              >
                Remove
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className={cn("text-muted-foreground text-xs font-medium capitalize")}>
            {grant.role}
          </span>
        )}
      </div>
    </div>
  );
}
