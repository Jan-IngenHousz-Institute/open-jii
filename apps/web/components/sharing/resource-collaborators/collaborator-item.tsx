"use client";

import { Building2, Trash2, Users } from "lucide-react";

import type { ResourceGrantWithGranteeDto } from "@repo/api/schemas/sharing.schema";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { UserAvatar } from "../../user-avatar";

interface CollaboratorItemProps {
  grant: ResourceGrantWithGranteeDto;
  canManage: boolean;
  isBusy: boolean;
  onRoleChange: (role: string) => void;
  onRemove: () => void;
}

const TYPE_SUBLABEL: Record<string, string> = {
  organization: "Organization",
  team: "Team",
};

function splitName(displayName: string): [string, string] {
  const parts = displayName.trim().split(/\s+/);
  return [parts[0] ?? "", parts.length > 1 ? parts[parts.length - 1] : ""];
}

/** One GitHub-style access row: avatar, name + handle/label, Role dropdown, delete. */
export function CollaboratorItem({
  grant,
  canManage,
  isBusy,
  onRoleChange,
  onRemove,
}: CollaboratorItemProps) {
  const name = grant.grantee.displayName ?? grant.granteeId;
  const isOwner = grant.role === "owner";

  // GitHub-style sublabel under the name.
  const sublabel =
    grant.granteeType === "user"
      ? grant.grantee.isOrgMember
        ? (grant.grantee.email ?? "Member")
        : "Outside Collaborator"
      : (TYPE_SUBLABEL[grant.granteeType] ?? null);

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
        <div className="bg-primary/10 text-primary grid h-9 w-9 shrink-0 place-items-center rounded-md">
          {grant.granteeType === "organization" ? (
            <Building2 className="h-4 w-4" />
          ) : (
            <Users className="h-4 w-4" />
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-foreground truncate text-sm font-semibold" title={name}>
          {name}
        </span>
        {sublabel && (
          <span className="text-muted-foreground truncate text-xs" title={sublabel}>
            {sublabel}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canManage && !isOwner ? (
          <Select value={grant.role} disabled={isBusy} onValueChange={onRoleChange}>
            <SelectTrigger className="h-9 w-[130px]" aria-label={`Role for ${name}`}>
              <span className="text-muted-foreground mr-1 text-xs">Role:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="member">member</SelectItem>
              <SelectItem value="viewer">viewer</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-muted-foreground text-xs font-medium">Role: {grant.role}</span>
        )}
        {canManage && !isOwner && (
          <Button
            variant="outline"
            size="icon"
            className="text-destructive hover:text-destructive h-9 w-9"
            disabled={isBusy}
            onClick={onRemove}
            aria-label={`Remove access for ${name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
