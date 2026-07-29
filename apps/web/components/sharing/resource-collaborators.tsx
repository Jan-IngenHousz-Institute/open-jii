"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useResourceCollaborators } from "@/hooks/sharing/useResourceCollaborators/useResourceCollaborators";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

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
  /** Heading overrides for hosts that word the surface differently. */
  title?: string;
  description?: string;
}

/**
 * The collaborators surface for macros, protocols and workbooks — the body of
 * their Collaborators tab: an add action, then the grant rows.
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
  title,
  description,
}: ResourceCollaboratorsProps) {
  const { t } = useTranslation();

  const {
    data: grants,
    isPending,
    error,
  } = useResourceCollaborators(resourceType, resourceId, { enabled: canShare !== false });

  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Not authorized to share (403) or the resource is gone (404) → no surface.
  // Same while the probe is in flight: showing nothing beats flashing a heading
  // that then vanishes for most viewers.
  const status = getErrorStatus(error);
  if (canShare === false || isPending || status === 403 || status === 404) {
    return null;
  }

  const collaborators = grants ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-medium">{title ?? t("sharing.cardTitle")}</h3>
          <p className="text-muted-foreground text-sm">
            {description ?? t("sharing.cardDescription")}
          </p>
          <DocsHelpLink path="/guide/sharing" className="mt-1" />
        </div>
        <Button onClick={() => setIsInviteOpen(true)} disabled={readOnly}>
          <UserPlus className="h-4 w-4" />
          {t("sharing.addCollaborator")}
        </Button>
      </div>

      <CollaboratorsList
        resourceType={resourceType}
        resourceId={resourceId}
        grants={collaborators}
        isError={!!error}
        readOnly={readOnly}
      />

      <CollaboratorInviteDialog
        resourceType={resourceType}
        resourceId={resourceId}
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        title={t("sharing.addCollaboratorTitle")}
        description={t("sharing.addCollaboratorDescription")}
        disabled={readOnly}
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
