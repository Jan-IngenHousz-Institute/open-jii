"use client";

import { useOrganizationAccess } from "@/hooks/organization/useOrganizationAccess";
import { Building2, Lock, Users } from "lucide-react";

import { Skeleton } from "@repo/ui/components/skeleton";

import { UserAvatar } from "../../user-avatar";

interface OrganizationAccessListProps {
  organizationId: string | null;
}

function splitName(displayName: string): [string, string] {
  const parts = displayName.trim().split(/\s+/);
  return [parts[0] ?? "", parts.length > 1 ? parts[parts.length - 1] : ""];
}

/** Read-only list of who inherits access through the owning org (members + teams). */
export function OrganizationAccessList({ organizationId }: OrganizationAccessListProps) {
  const { data, isPending, error } = useOrganizationAccess(organizationId);

  if (!organizationId) {
    return (
      <p className="text-muted-foreground px-3 py-8 text-center text-sm">
        This resource is not owned by an organization.
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="divide-border divide-y overflow-hidden rounded-lg border">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-10 text-center">
        <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
          <Lock className="h-5 w-5" />
        </div>
        <p className="text-foreground text-sm font-semibold">Organization access is private</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Only members of the owning organization can see who has access through it.
        </p>
      </div>
    );
  }

  const { organization, members, teams } = data.body;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        These members and teams can access this resource through{" "}
        <span className="text-foreground font-medium">{organization.name}</span>.
      </p>

      {teams.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Teams ({teams.length})</h4>
          <div className="divide-border divide-y overflow-hidden rounded-lg border">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="bg-primary/10 text-primary grid h-9 w-9 shrink-0 place-items-center rounded-md">
                  <Users className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate text-sm font-semibold">{team.name}</span>
                <span className="text-muted-foreground text-xs">
                  {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Members ({members.length})</h4>
        {members.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 rounded-lg border px-3 py-6 text-sm">
            <Building2 className="h-4 w-4" />
            No organization members.
          </div>
        ) : (
          <div className="divide-border divide-y overflow-hidden rounded-lg border">
            {members.map((member) => {
              const name = member.displayName ?? member.email ?? "Member";
              return (
                <div key={member.id} className="flex items-center gap-3 px-3 py-2.5">
                  <UserAvatar
                    avatarUrl={member.avatarUrl}
                    firstName={splitName(name)[0]}
                    lastName={splitName(name)[1]}
                    className="h-9 w-9"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{name}</span>
                    {member.email && (
                      <span className="text-muted-foreground truncate text-xs">{member.email}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs font-medium capitalize">
                    {member.role}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
