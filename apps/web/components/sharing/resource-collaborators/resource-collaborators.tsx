"use client";

import { Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useResourceAccess } from "~/hooks/sharing/useResourceAccess";
import { useResourceGrants } from "~/hooks/sharing/useResourceGrants";
import { useRevokeResourceGrant } from "~/hooks/sharing/useRevokeResourceGrant";
import { useUpdateResourceGrant } from "~/hooks/sharing/useUpdateResourceGrant";

import type { GrantRoleValue, ResourceTypeValue } from "@repo/api/schemas/sharing.schema";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CollaboratorItem } from "./collaborator-item";
import { ShareCollaboratorDialog } from "./share-collaborator-dialog";

interface ResourceCollaboratorsProps {
  resourceType: ResourceTypeValue;
  resourceId: string;
}

/**
 * Unified collaborators panel for any resource: lists who has access (people,
 * teams, organizations) with their roles, and lets a user who can share add,
 * re-role, or remove access. Backed by resource_grants.
 */
export function ResourceCollaborators({ resourceType, resourceId }: ResourceCollaboratorsProps) {
  const { data: accessRes } = useResourceAccess(resourceType, resourceId);
  const { data: grantsRes, isPending } = useResourceGrants(resourceType, resourceId);
  const updateGrant = useUpdateResourceGrant();
  const revokeGrant = useRevokeResourceGrant();

  const [filter, setFilter] = useState("");
  const [isShareOpen, setIsShareOpen] = useState(false);

  const canShare = accessRes?.body.canShare ?? false;
  const grants = useMemo(() => grantsRes?.body ?? [], [grantsRes]);

  const grantedIds = useMemo(() => new Set(grants.map((g) => g.granteeId)), [grants]);

  const normalized = filter.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return grants;
    return grants.filter((g) => {
      const name = (g.grantee.displayName ?? g.granteeId).toLowerCase();
      const email = (g.grantee.email ?? "").toLowerCase();
      return name.includes(normalized) || email.includes(normalized);
    });
  }, [grants, normalized]);

  const onValueChange = (grantId: string, value: string) => {
    if (value === "remove") {
      revokeGrant.mutate({ params: { resourceType, resourceId, grantId } });
      return;
    }
    updateGrant.mutate({
      params: { resourceType, resourceId, grantId },
      body: { role: value as GrantRoleValue },
    });
  };

  return (
    <section aria-label="Collaborators" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">People with access</h3>
          <p className="text-muted-foreground text-sm">
            Share this with people, teams, or organizations.
          </p>
        </div>
        {canShare && (
          <Button onClick={() => setIsShareOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Share
          </Button>
        )}
      </div>

      {grants.length > 4 && (
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter collaborators…"
            className="pl-9"
          />
        </div>
      )}

      {isPending ? (
        <div className="divide-border divide-y overflow-hidden rounded-lg border">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-9 w-[110px]" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
            <Users className="h-5 w-5" />
          </div>
          <p className="text-foreground text-sm font-semibold">
            {grants.length === 0 ? "Not shared with anyone yet" : "No matching collaborators"}
          </p>
          {grants.length === 0 && canShare && (
            <p className="text-muted-foreground mx-auto mt-1 max-w-[280px] text-xs leading-relaxed">
              Use Share to give people, teams, or organizations access.
            </p>
          )}
        </div>
      ) : (
        <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {filtered.map((g) => (
            <CollaboratorItem
              key={g.id}
              grant={g}
              canShare={canShare}
              isUpdating={
                (updateGrant.isPending || revokeGrant.isPending) &&
                (updateGrant.variables?.params.grantId === g.id ||
                  revokeGrant.variables?.params.grantId === g.id)
              }
              onValueChange={(value) => onValueChange(g.id, value)}
            />
          ))}
        </div>
      )}

      {canShare && (
        <ShareCollaboratorDialog
          resourceType={resourceType}
          resourceId={resourceId}
          open={isShareOpen}
          onOpenChange={setIsShareOpen}
          grantedIds={grantedIds}
        />
      )}
    </section>
  );
}
