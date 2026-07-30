"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useResourceCollaborators } from "@/hooks/sharing/useResourceCollaborators/useResourceCollaborators";
import { Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { matchesGrantee } from "~/util/collaborator-filter";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

import { CollaboratorInviteDialog } from "./collaborator-invite-dialog";
import { CollaboratorsList } from "./collaborators-list";

interface ResourceCollaboratorsProps {
  resourceType: SharingResourceType;
  resourceId: string;
  /** Blocks every mutation (e.g. an archived resource) while still listing grants. */
  readOnly?: boolean;
  /**
   * `can(share)` from a detail response that already carries the capability
   * signal. When explicitly `false` the surface renders nothing and skips the list
   * request altogether, sparing a request whose only purpose was to come back 403.
   * Omit it where no capability signal is delivered to the page — the 403 probe
   * remains the fallback.
   */
  canShare?: boolean;
}

/**
 * The collaborators surface for macros, protocols and workbooks — the body of
 * their Collaborators route: a heading, one row carrying the filter and the
 * invite action, then the grant rows.
 *
 * Experiments compose the same pieces themselves, because there the list shares a
 * filter and a tab strip with pending invitations and join requests.
 *
 * **Visibility is driven by the list endpoint itself.** `listGrants` is gated on
 * `can(share)`, so a caller who may not share gets a 403 — the component renders
 * nothing at all in that case, and likewise while the probe is still in flight, so
 * a heading never appears and then disappears. Pages that already receive that
 * capability signal pass `canShare` instead, which short-circuits to the same
 * outcome without spending the request.
 */
export function ResourceCollaborators({
  resourceType,
  resourceId,
  readOnly = false,
  canShare,
}: ResourceCollaboratorsProps) {
  const { t } = useTranslation();

  const {
    data: grants,
    isPending,
    error,
  } = useResourceCollaborators(resourceType, resourceId, { enabled: canShare !== false });

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const collaborators = useMemo(() => grants ?? [], [grants]);
  const normalizedFilter = filter.trim().toLowerCase();

  // Filtering is local, as on the experiment surface: the list is a roster, not a
  // paged query. Owner and grant rows both carry a `grantee`, so one predicate
  // covers the whole union.
  const filteredCollaborators = useMemo(() => {
    if (!normalizedFilter) return collaborators;
    return collaborators.filter((row) => matchesGrantee(row.grantee, normalizedFilter));
  }, [collaborators, normalizedFilter]);

  // Not authorized to share (403) or the resource is gone (404) → no surface.
  // Same while the probe is in flight: showing nothing beats flashing a heading
  // that then vanishes for most viewers.
  const status = getErrorStatus(error);
  if (canShare === false || isPending || status === 403 || status === 404) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{t("sharing.cardTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("sharing.cardDescription")}</p>
        <DocsHelpLink path="/guide/sharing" className="mt-1" />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("sharing.filterCollaboratorsPlaceholder")}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setIsInviteOpen(true)} disabled={readOnly}>
          <UserPlus className="h-4 w-4" />
          {t("sharing.invite")}
        </Button>
      </div>

      <CollaboratorsList
        resourceType={resourceType}
        resourceId={resourceId}
        grants={filteredCollaborators}
        isError={!!error}
        readOnly={readOnly}
        isFiltered={normalizedFilter.length > 0}
      />

      <CollaboratorInviteDialog
        resourceType={resourceType}
        resourceId={resourceId}
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        title={t("sharing.addCollaboratorTitle")}
        description={t("sharing.addCollaboratorDescription")}
        disabled={readOnly}
        // The dialog dedupes against everyone already on the resource, which the
        // filter must not be able to narrow.
        existingGranteeIds={collaborators.map((grant) => grant.granteeId)}
      />
    </section>
  );
}

/** HTTP status carried by an oRPC error, when there is one. */
function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  return undefined;
}
