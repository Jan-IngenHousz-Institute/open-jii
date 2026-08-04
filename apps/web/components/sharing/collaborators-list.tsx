"use client";

import { useCollaboratorRevoke } from "@/hooks/sharing/useCollaboratorRevoke/useCollaboratorRevoke";
import { useCollaboratorRoleUpdate } from "@/hooks/sharing/useCollaboratorRoleUpdate/useCollaboratorRoleUpdate";
import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type {
  ResourceCollaboratorDto,
  ResourceGrantDto,
  ShareableRole,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { CollaboratorRow } from "./collaborator-row";
import { RevokeCollaboratorDialog } from "./revoke-collaborator-dialog";

interface CollaboratorsListProps {
  resourceType: SharingResourceType;
  resourceId: string;
  /** Owners and grants, already filtered by the host when applicable. */
  grants: ResourceCollaboratorDto[];
  /** The list request failed; rows are unknown rather than absent. */
  isError?: boolean;
  /** Whether the list is unresolved rather than empty. */
  isPending?: boolean;
  /** Blocks every mutation (e.g. an archived experiment) while still listing grants. */
  readOnly?: boolean;
  /** An empty list is the filter's doing, not the resource's state. */
  isFiltered?: boolean;
}

/**
 * Owners come from the owning organization, not grants, so they have no role or
 * revoke controls. A grantee's own revoke becomes their only self-leave action.
 * Staffing refusals remain server-enforced, and their message is surfaced verbatim
 * so the client does not duplicate or obscure that invariant.
 */
export function CollaboratorsList({
  resourceType,
  resourceId,
  grants,
  isError = false,
  isPending = false,
  readOnly = false,
  isFiltered = false,
}: CollaboratorsListProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const currentUserId = session?.user.id;

  const { mutateAsync: updateRole } = useCollaboratorRoleUpdate();
  const { mutateAsync: revoke, isPending: isRevoking } = useCollaboratorRevoke();

  const [busyGrantId, setBusyGrantId] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<ResourceGrantDto | null>(null);

  // Close the live revoke path if the surface becomes read-only mid-session.
  useEffect(() => {
    if (readOnly) setPendingRevoke(null);
  }, [readOnly]);

  const isSelfRow = (row: ResourceCollaboratorDto) =>
    !!currentUserId && row.granteeType === "user" && row.granteeId === currentUserId;

  // Owners first, then the signed-in user's grant.
  const sortedGrants = [...grants].sort((a, b) => {
    const byOwner = Number(b.kind === "owner") - Number(a.kind === "owner");
    return byOwner !== 0 ? byOwner : Number(isSelfRow(b)) - Number(isSelfRow(a));
  });

  const handleRoleChange = async (grant: ResourceGrantDto, role: ShareableRole) => {
    setBusyGrantId(grant.id);
    try {
      await updateRole({ resourceType, id: resourceId, grantId: grant.id, role });
      toast({ description: t("sharing.roleUpdated") });
    } catch (err) {
      toast({
        description: parseApiError(err)?.message ?? t("sharing.roleUpdateFailed"),
        variant: "destructive",
      });
    } finally {
      setBusyGrantId(null);
    }
  };

  const confirmRevoke = async () => {
    // Guard against a confirm racing with a read-only transition.
    if (readOnly || !pendingRevoke) return;
    const grant = pendingRevoke;
    setBusyGrantId(grant.id);
    try {
      await revoke({ resourceType, id: resourceId, grantId: grant.id });
      toast({
        description: isSelfRow(grant)
          ? t("sharing.leftResource")
          : t("sharing.collaboratorRevoked"),
      });
      setPendingRevoke(null);
    } catch (err) {
      toast({
        description: parseApiError(err)?.message ?? t("sharing.revokeFailed"),
        variant: "destructive",
      });
    } finally {
      setBusyGrantId(null);
    }
  };

  if (isError) {
    return <p className="text-destructive text-sm">{t("sharing.loadFailed")}</p>;
  }

  // Do not show an empty-state claim until the list has answered.
  if (isPending) {
    return (
      <div
        aria-busy="true"
        className="border-border divide-border divide-y overflow-hidden rounded-lg border"
      >
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>
    );
  }

  if (sortedGrants.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
          <Users className="h-5 w-5" />
        </div>
        <p className="text-foreground text-sm font-semibold">
          {isFiltered ? t("sharing.noMatchingCollaborators") : t("sharing.noCollaboratorsYet")}
        </p>
        {!isFiltered && (
          <p className="text-muted-foreground mx-auto mt-1 max-w-[320px] text-xs leading-relaxed">
            {t("sharing.noCollaboratorsHint")}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        role="list"
        className="border-border divide-border divide-y overflow-hidden rounded-lg border"
      >
        {sortedGrants.map((row) => (
          <CollaboratorRow
            // Owner rows have no grant id.
            key={row.kind === "owner" ? `owner-${row.granteeId}` : row.id}
            collaborator={row}
            isSelf={isSelfRow(row)}
            isBusy={row.kind === "grant" && busyGrantId === row.id}
            disabled={readOnly}
            onRoleChange={(role) => {
              if (row.kind === "grant") void handleRoleChange(row, role);
            }}
            onRevoke={() => {
              if (row.kind === "grant") setPendingRevoke(row);
            }}
          />
        ))}
      </div>

      <RevokeCollaboratorDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRevoke(null);
        }}
        granteeName={
          pendingRevoke?.grantee.displayName ??
          pendingRevoke?.grantee.email ??
          pendingRevoke?.granteeId ??
          ""
        }
        isSelf={pendingRevoke !== null && isSelfRow(pendingRevoke)}
        isRevoking={isRevoking}
        confirmDisabled={readOnly}
        onConfirm={() => void confirmRevoke()}
      />
    </>
  );
}
