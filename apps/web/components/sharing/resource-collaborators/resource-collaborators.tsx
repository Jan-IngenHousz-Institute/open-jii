"use client";

import { Building2, Globe, Lock, Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useOrganizationAccess } from "~/hooks/organization/useOrganizationAccess";
import { useResourceAccess } from "~/hooks/sharing/useResourceAccess";
import { useResourceGrants } from "~/hooks/sharing/useResourceGrants";
import { useRevokeResourceGrant } from "~/hooks/sharing/useRevokeResourceGrant";
import { useUpdateResourceGrant } from "~/hooks/sharing/useUpdateResourceGrant";

import type { GrantRoleValue, ResourceTypeValue } from "@repo/api/schemas/sharing.schema";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { NavTabs, NavTabsContent, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CollaboratorItem } from "./collaborator-item";
import { OrganizationAccessList } from "./organization-access-list";
import { ShareCollaboratorDialog } from "./share-collaborator-dialog";

interface ResourceCollaboratorsProps {
  resourceType: ResourceTypeValue;
  resourceId: string;
}

/**
 * GitHub-style "Collaborators and teams" surface for any resource: a base-role /
 * direct-access / organization-access summary, then a Direct access table (people,
 * teams, orgs granted directly — with roles + remove) and an Organization access
 * tab (who inherits via the owning org). Backed by resource_grants + /access.
 */
export function ResourceCollaborators({ resourceType, resourceId }: ResourceCollaboratorsProps) {
  const { data: accessRes } = useResourceAccess(resourceType, resourceId);
  const { data: grantsRes, isPending } = useResourceGrants(resourceType, resourceId);
  const updateGrant = useUpdateResourceGrant();
  const revokeGrant = useRevokeResourceGrant();

  const canManage = accessRes?.body.canShare ?? false;
  const visibility = accessRes?.body.visibility ?? null;
  const organizationId = accessRes?.body.organizationId ?? null;
  const isPublic = visibility === "public";

  const { data: orgAccessRes } = useOrganizationAccess(organizationId);
  const orgAccess = orgAccessRes?.body;

  const grants = useMemo(() => grantsRes?.body ?? [], [grantsRes]);
  const grantedIds = useMemo(() => new Set(grants.map((g) => g.granteeId)), [grants]);

  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMode, setShareMode] = useState<"user" | "team">("user");

  // Direct-access summary counts.
  const counts = useMemo(() => {
    const userGrants = grants.filter((g) => g.granteeType === "user");
    return {
      members: userGrants.filter((g) => g.grantee.isOrgMember).length,
      outside: userGrants.filter((g) => !g.grantee.isOrgMember).length,
      teams: grants.filter((g) => g.granteeType === "team").length,
      orgs: grants.filter((g) => g.granteeType === "organization").length,
    };
  }, [grants]);

  const normalized = filter.trim().toLowerCase();
  const filtered = useMemo(() => {
    return grants.filter((g) => {
      if (typeFilter !== "all" && g.granteeType !== typeFilter) return false;
      if (roleFilter !== "all" && g.role !== roleFilter) return false;
      if (!normalized) return true;
      const name = (g.grantee.displayName ?? g.granteeId).toLowerCase();
      const email = (g.grantee.email ?? "").toLowerCase();
      return name.includes(normalized) || email.includes(normalized);
    });
  }, [grants, typeFilter, roleFilter, normalized]);

  const openShare = (mode: "user" | "team") => {
    setShareMode(mode);
    setShareOpen(true);
  };

  const isBusy = (grantId: string) =>
    (updateGrant.isPending || revokeGrant.isPending) &&
    (updateGrant.variables?.params.grantId === grantId ||
      revokeGrant.variables?.params.grantId === grantId);

  return (
    <section aria-label="Collaborators and teams" className="space-y-6">
      <h2 className="text-2xl font-semibold">Collaborators and teams</h2>

      {/* Visibility card (display-only). */}
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <div className="bg-muted text-muted-foreground grid h-10 w-10 shrink-0 place-items-center rounded-md">
          {isPublic ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{isPublic ? "Public" : "Private"}</p>
          <p className="text-muted-foreground text-sm">
            {isPublic
              ? "This resource is public and visible to anyone."
              : "This resource is private — only members and collaborators can access it."}
          </p>
        </div>
      </div>

      {/* Summary cards. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard title="Base role" icon={isPublic ? Globe : Lock}>
          {isPublic ? "Anyone can read this resource." : "Members and collaborators only."}
        </SummaryCard>
        <SummaryCard title="Direct access" icon={Users}>
          {grants.length} {grants.length === 1 ? "entity has" : "entities have"} direct access
          {counts.outside > 0 ? ` · ${counts.outside} outside` : ""}.
        </SummaryCard>
        <SummaryCard title="Organization access" icon={Building2}>
          {orgAccess
            ? `${orgAccess.members.length} ${orgAccess.members.length === 1 ? "member" : "members"} and ${orgAccess.teams.length} ${orgAccess.teams.length === 1 ? "team" : "teams"}.`
            : organizationId
              ? "Through the owning organization."
              : "Not owned by an organization."}
        </SummaryCard>
      </div>

      {/* Manage access toolbar. */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Manage access</h3>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openShare("user")}>
              <UserPlus className="h-4 w-4" />
              Add people
            </Button>
            <Button variant="outline" onClick={() => openShare("team")}>
              <Users className="h-4 w-4" />
              Add teams
            </Button>
          </div>
        )}
      </div>

      <NavTabs defaultValue="direct" className="w-full">
        <NavTabsList>
          <NavTabsTrigger value="direct" count={grants.length}>
            Direct access
          </NavTabsTrigger>
          <NavTabsTrigger value="organization">Organization access</NavTabsTrigger>
        </NavTabsList>

        <NavTabsContent value="direct" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]" aria-label="Filter by type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="user">People</SelectItem>
                <SelectItem value="team">Teams</SelectItem>
                <SelectItem value="organization">Organizations</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[130px]" aria-label="Filter by role">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="owner">owner</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="member">member</SelectItem>
                <SelectItem value="viewer">viewer</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find people or a team…"
                aria-label="Find people or a team"
                className="pl-9"
              />
            </div>
          </div>

          {isPending ? (
            <div className="divide-border divide-y overflow-hidden rounded-lg border">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-40 flex-1" />
                  <Skeleton className="h-9 w-[130px]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-foreground text-sm font-semibold">
                {grants.length === 0 ? "No direct access yet" : "No matching collaborators"}
              </p>
              {grants.length === 0 && canManage && (
                <p className="text-muted-foreground mx-auto mt-1 max-w-[280px] text-xs leading-relaxed">
                  Use Add people or Add teams to grant direct access.
                </p>
              )}
            </div>
          ) : (
            <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
              {filtered.map((g) => (
                <CollaboratorItem
                  key={g.id}
                  grant={g}
                  canManage={canManage}
                  isBusy={isBusy(g.id)}
                  onRoleChange={(role) =>
                    updateGrant.mutate({
                      params: { resourceType, resourceId, grantId: g.id },
                      body: { role: role as GrantRoleValue },
                    })
                  }
                  onRemove={() =>
                    revokeGrant.mutate({ params: { resourceType, resourceId, grantId: g.id } })
                  }
                />
              ))}
            </div>
          )}
        </NavTabsContent>

        <NavTabsContent value="organization">
          <OrganizationAccessList organizationId={organizationId} />
        </NavTabsContent>
      </NavTabs>

      {canManage && (
        <ShareCollaboratorDialog
          resourceType={resourceType}
          resourceId={resourceId}
          open={shareOpen}
          onOpenChange={setShareOpen}
          grantedIds={grantedIds}
          initialMode={shareMode}
        />
      )}
    </section>
  );
}

function SummaryCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <span className="text-sm font-semibold">{title}</span>
        <Icon className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{children}</p>
      </CardContent>
    </Card>
  );
}
