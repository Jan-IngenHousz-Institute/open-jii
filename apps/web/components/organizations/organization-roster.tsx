"use client";

import { useLeaveOrganization } from "@/hooks/organization/useLeaveOrganization/useLeaveOrganization";
import { useOrganizationMemberRows } from "@/hooks/organization/useOrganizationMemberRows/useOrganizationMemberRows";
import { useRemoveOrganizationMember } from "@/hooks/organization/useRemoveOrganizationMember/useRemoveOrganizationMember";
import { useUpdateOrganizationMemberRole } from "@/hooks/organization/useUpdateOrganizationMemberRole/useUpdateOrganizationMemberRole";
import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";

import type {
  OrganizationMember,
  OrganizationRole,
} from "@repo/api/domains/organization/organization.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { OrganizationConfirmDialog } from "./organization-confirm-dialog";
import { asOrganizationRole } from "./organization-labels";
import { OrganizationMemberRow } from "./organization-member-row";
import {
  assignableRoles,
  countOwners,
  leaveRejection,
  removeRejection,
} from "./organization-roster-rules";
import { organizationsPath } from "./organization-routes";

interface OrganizationRosterProps {
  organizationId: string;
  members: OrganizationMember[];
  /** The signed-in caller's own role in this organization. */
  actorRole: OrganizationRole;
  /** Which teams each member is on, joined client-side from the teams list. */
  teamNamesByUserId: Map<string, string[]>;
  isPending: boolean;
  isError: boolean;
}

/**
 * The roster. Role changes address a Better Auth `member` row by its own id, which
 * the profile-joined roster does not carry — so the member rows are read
 * separately and joined on `userId`. A member whose row has not resolved yet gets
 * no role control rather than a control that would address the wrong row.
 */
export function OrganizationRoster({
  organizationId,
  members,
  actorRole,
  teamNamesByUserId,
  isPending,
  isError,
}: OrganizationRosterProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = useLocale();
  const { data: session } = useSession();
  const currentUserId = session?.user.id;

  const { data: memberRows } = useOrganizationMemberRows(organizationId);
  const { mutateAsync: updateRole } = useUpdateOrganizationMemberRole(organizationId);
  const { mutateAsync: removeMember, isPending: isRemoving } =
    useRemoveOrganizationMember(organizationId);
  const { mutateAsync: leaveOrganization, isPending: isLeaving } = useLeaveOrganization();

  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<OrganizationMember | null>(null);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);

  const memberIdByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of memberRows?.members ?? []) map.set(row.userId, row.id);
    return map;
  }, [memberRows]);

  const normalized = useMemo(
    () => members.map((member) => ({ ...member, orgRole: asOrganizationRole(member.role) })),
    [members],
  );
  const ownerCount = countOwners(normalized.map(({ orgRole }) => ({ role: orgRole })));

  const actor = { userId: currentUserId ?? "", role: actorRole };

  const handleRoleChange = async (member: OrganizationMember, role: OrganizationRole) => {
    const memberId = memberIdByUserId.get(member.userId);
    if (!memberId) return;

    setBusyUserId(member.userId);
    try {
      await updateRole({ memberId, role });
      toast({ description: t("organizations.members.roleUpdated") });
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.members.roleUpdateFailed"),
        variant: "destructive",
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const confirmRemoval = async () => {
    if (!pendingRemoval) return;
    const target = pendingRemoval;
    // The member row id when it has resolved, the address as the fallback: Better
    // Auth accepts either, and an unresolved row must not block a removal.
    const identifier = memberIdByUserId.get(target.userId) ?? target.email;
    if (!identifier) {
      toast({
        description: t("organizations.members.removeFailed"),
        variant: "destructive",
      });
      return;
    }

    setBusyUserId(target.userId);
    try {
      await removeMember({ memberIdOrEmail: identifier });
      toast({ description: t("organizations.members.removed") });
      setPendingRemoval(null);
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.members.removeFailed"),
        variant: "destructive",
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const confirmLeave = async () => {
    try {
      await leaveOrganization({ organizationId });
      toast({ description: t("organizations.members.left") });
      setIsLeaveOpen(false);
      // The organization may no longer be readable, so do not stay on its routes.
      router.push(organizationsPath(locale));
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.members.leaveFailed"),
        variant: "destructive",
      });
    }
  };

  if (isError) {
    return <p className="text-destructive text-sm">{t("organizations.members.loadFailed")}</p>;
  }

  if (isPending) {
    return (
      <Card aria-busy="true" className="divide-border divide-y overflow-hidden">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3 px-5 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </Card>
    );
  }

  return (
    <>
      <Card role="list" className="divide-border divide-y overflow-hidden">
        {normalized.map((member) => {
          const target = { userId: member.userId, role: member.orgRole };
          const isSelf = member.userId === currentUserId;
          const displayName =
            `${member.firstName} ${member.lastName}`.trim() || (member.email ?? member.userId);
          // No member row id means a role change would have nothing to address.
          const canAddressRow = memberIdByUserId.has(member.userId);

          return (
            <OrganizationMemberRow
              key={member.userId}
              displayName={displayName}
              email={member.email}
              avatarUrl={member.avatarUrl}
              firstName={member.firstName}
              lastName={member.lastName}
              role={member.orgRole}
              isSelf={isSelf}
              teamNames={teamNamesByUserId.get(member.userId) ?? []}
              assignableRoles={canAddressRow ? assignableRoles(actor, target, ownerCount) : []}
              removeRejection={removeRejection(actor, target, ownerCount)}
              leaveRejection={isSelf ? leaveRejection(member.orgRole, ownerCount) : null}
              isBusy={busyUserId === member.userId}
              onRoleChange={(role) => void handleRoleChange(member, role)}
              onRemove={() => setPendingRemoval(member)}
              onLeave={() => setIsLeaveOpen(true)}
            />
          );
        })}
      </Card>

      <OrganizationConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title={t("organizations.members.removeTitle")}
        description={t("organizations.members.removeDescription", {
          name:
            `${pendingRemoval?.firstName ?? ""} ${pendingRemoval?.lastName ?? ""}`.trim() ||
            (pendingRemoval?.email ?? ""),
        })}
        note={t("organizations.members.removeNote")}
        confirmLabel={t("common.remove")}
        pendingLabel={t("organizations.members.removing")}
        isPending={isRemoving}
        onConfirm={() => void confirmRemoval()}
      />

      <OrganizationConfirmDialog
        open={isLeaveOpen}
        onOpenChange={setIsLeaveOpen}
        title={t("organizations.members.leaveTitle")}
        description={t("organizations.members.leaveDescription")}
        note={t("organizations.members.leaveNote")}
        confirmLabel={t("organizations.members.leaveAction")}
        pendingLabel={t("organizations.members.leaving")}
        isPending={isLeaving}
        onConfirm={() => void confirmLeave()}
      />
    </>
  );
}
