"use client";

import { useState } from "react";
import { useGrantResource } from "~/hooks/sharing/useGrantResource";
import { useResourceAccess } from "~/hooks/sharing/useResourceAccess";
import { useResourceGrants } from "~/hooks/sharing/useResourceGrants";
import { useRevokeResourceGrant } from "~/hooks/sharing/useRevokeResourceGrant";
import { useUserSearch } from "~/hooks/useUserSearch";

import type { ResourceTypeValue } from "@repo/api/schemas/sharing.schema";
import { Button } from "@repo/ui/components/button";

interface ResourceSharingProps {
  resourceType: ResourceTypeValue;
  resourceId: string;
}

/**
 * Generalized sharing panel for any resource: lists current grants and (when the
 * caller can share) lets them grant access to other users. Backed by resource_grants.
 */
export function ResourceSharing({ resourceType, resourceId }: ResourceSharingProps) {
  const { data: accessRes } = useResourceAccess(resourceType, resourceId);
  const { data: grantsRes, isPending } = useResourceGrants(resourceType, resourceId);
  const grant = useGrantResource();
  const revoke = useRevokeResourceGrant();
  const [query, setQuery] = useState("");
  const { data: searchRes } = useUserSearch(query);

  const canShare = accessRes?.body.canShare ?? false;
  const grants = grantsRes?.body ?? [];
  const grantedUserIds = new Set(
    grants.filter((g) => g.granteeType === "user").map((g) => g.granteeId),
  );
  const candidates = (searchRes?.body ?? []).filter((u) => !grantedUserIds.has(u.userId));

  const share = (granteeId: string) => {
    grant.mutate({
      params: { resourceType, resourceId },
      body: { granteeType: "user", granteeId, role: "member" },
    });
    setQuery("");
  };

  return (
    <section aria-label="Sharing" className="space-y-4">
      <h3 className="text-lg font-semibold">Sharing</h3>

      {isPending ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : grants.length === 0 ? (
        <p className="text-muted-foreground text-sm">Not shared with anyone yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {grants.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="truncate text-sm">
                <span className="text-muted-foreground mr-2 uppercase">{g.granteeType}</span>
                {g.granteeId}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs font-medium">{g.role}</span>
                {canShare && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending}
                    onClick={() =>
                      revoke.mutate({ params: { resourceType, resourceId, grantId: g.id } })
                    }
                    aria-label={`Remove access for ${g.granteeId}`}
                  >
                    Remove
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canShare && (
        <div className="space-y-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people to share with…"
            aria-label="Search people to share with"
            className="h-9 w-full rounded-md border px-3 text-sm focus:outline-none"
          />
          {candidates.length > 0 && (
            <ul className="divide-y rounded-md border">
              {candidates.map((u) => (
                <li key={u.userId} className="flex items-center justify-between px-3 py-2">
                  <span className="truncate text-sm">
                    {u.firstName} {u.lastName}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={grant.isPending}
                    onClick={() => share(u.userId)}
                  >
                    Share
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
