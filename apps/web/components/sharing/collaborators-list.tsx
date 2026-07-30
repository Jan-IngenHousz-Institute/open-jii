"use client";

import { useCollaboratorRevoke } from "@/hooks/sharing/useCollaboratorRevoke/useCollaboratorRevoke";
import { useCollaboratorRoleUpdate } from "@/hooks/sharing/useCollaboratorRoleUpdate/useCollaboratorRoleUpdate";
import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type {
  ResourceCollaboratorDto,
  ResourceGrantDto,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

import type { ShareableRole } from "./collaborator-roles";
import { CollaboratorRow } from "./collaborator-row";
import { RevokeCollaboratorDialog } from "./revoke-collaborator-dialog";

interface CollaboratorsListProps {
  resourceType: SharingResourceType;
  resourceId: string;
  /** The rows to render — owners and grants, already filtered by the host, if it filters. */
  grants: ResourceCollaboratorDto[];
  /** The list request failed; rows are unknown rather than absent. */
  isError?: boolean;
  /** Blocks every mutation (e.g. an archived experiment) while still listing grants. */
  readOnly?: boolean;
  /** An empty list is the filter's doing, not the resource's state. */
  isFiltered?: boolean;
}

/**
 * The collaborators list: the resource's owners, then one row per direct grant
 * with the two-tier access dropdown and revoke on each.
 *
 * Owners come from the owning organization rather than from a grant, so they sort
 * to the top and carry no controls — there is nothing to demote or revoke. Among
 * the grants the signed-in user's own sorts first and its revoke becomes "leave",
 * which is the only way a grantee gives up their own access; an owner has no such
 * affordance, because leaving is a matter of the organization.
 *
 * Rows carry no card chrome of their own — this is the body of a tab, so the host
 * page owns the heading, the filter and the invite action.
 *
 * Refusals stay server-side and are surfaced verbatim: the staffing invariant
 * (a resource with no living owner keeps its last direct admin) is enforced by
 * the backend, so a refused demotion or removal comes back as an error whose
 * message is what the toast shows.
 */
export function CollaboratorsList({
  resourceType,
  resourceId,
  grants,
  isError = false,
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

  // The surface can go read-only mid-session (an experiment archived in another
  // tab, a role downgrade landing on a refetch). Rows lock on their own via the
  // prop, but an already-open revoke dialog would otherwise remain a live
  // confirm path, so close it.
  useEffect(() => {
    if (readOnly) setPendingRevoke(null);
  }, [readOnly]);

  const isSelfRow = (row: ResourceCollaboratorDto) =>
    !!currentUserId && row.granteeType === "user" && row.granteeId === currentUserId;

  // Owners first — they are the resource's, not somebody it was shared with — then
  // "you", as on every other people list in the app.
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
    // Guarded as well as disabled: the dialog is closed the moment `readOnly`
    // flips, but a confirm already in flight when it does must not issue the
    // DELETE either.
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
            // Owner rows have no grant id — they are keyed by who they are, and a
            // person can hold at most one owner row and one grant row here.
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
