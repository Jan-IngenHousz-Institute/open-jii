"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useResourceCollaborators } from "@/hooks/sharing/useResourceCollaborators/useResourceCollaborators";
import { Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { matchesCollaborator } from "~/util/collaborator-filter";

import { isGranteeRow } from "@repo/api/domains/sharing/sharing.schema";
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
   * A known `false` skips a request guaranteed to 403. Omit when no capability
   * signal exists and let the share-gated list endpoint act as the probe.
   */
  canShare?: boolean;
}

/**
 * The share-gated list endpoint also decides whether this surface may exist.
 * Pending and denied probes render nothing so most viewers never see a heading
 * flash before the server's answer hides it.
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

  const filteredCollaborators = useMemo(() => {
    if (!normalizedFilter) return collaborators;
    return collaborators.filter((row) => matchesCollaborator(row, normalizedFilter));
  }, [collaborators, normalizedFilter]);

  // Hide the capability probe until it resolves, and on access/not-found errors.
  const status = getErrorStatus(error);
  if (canShare === false || isPending || status === 403 || status === 404) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{t("sharing.cardTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("sharing.cardDescription")}</p>
        <DocsHelpLink path="/guide/access" className="mt-1" />
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
        // Deduplicate against the unfiltered list.
        existingGranteeIds={collaborators.flatMap((row) =>
          isGranteeRow(row) ? [row.granteeId] : [],
        )}
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
