"use client";

import { useMemo, useState } from "react";

import type { UserProfile, ExperimentMemberRole, ExperimentMember, Invitation } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentMemberAdd } from "../../hooks/experiment/useExperimentMemberAdd/useExperimentMemberAdd";
import { useExperimentMemberRemove } from "../../hooks/experiment/useExperimentMemberRemove/useExperimentMemberRemove";
import { useDebounce } from "../../hooks/useDebounce";
import { useUserSearch } from "../../hooks/useUserSearch";
import { useUserInvitationCreate } from "../../hooks/user-invitation/useUserInvitationCreate/useUserInvitationCreate";
import { useUserInvitationRevoke } from "../../hooks/user-invitation/useUserInvitationRevoke/useUserInvitationRevoke";
import { useUserInvitationRoleUpdate } from "../../hooks/user-invitation/useUserInvitationRoleUpdate/useUserInvitationRoleUpdate";
import { useUserInvitations } from "../../hooks/user-invitation/useUserInvitations/useUserInvitations";
import { MemberList } from "../current-members-list/current-members-list";
import { UserSearchPopover } from "../user-search-popover";

type MemberSelection =
  | { type: "user"; user: UserProfile }
  | { type: "email"; email: string }
  | null;

interface ExperimentMemberManagementProps {
  experimentId: string;
  members: ExperimentMember[];
  isLoading: boolean;
  isError: boolean;
  isArchived?: boolean;
}

export function ExperimentMemberManagement({
  experimentId,
  members,
  isLoading,
  isError,
  isArchived = false,
}: ExperimentMemberManagementProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const adminCount = members.filter((m) => m.role === "admin").length;
  const currentUserId = session?.user.id;
  const currentMember = members.find((m) => m.user.id === currentUserId);
  const currentUserRole = currentMember?.role;

  // User search with debounced input
  const [userSearch, setUserSearch] = useState("");
  const [selection, setSelection] = useState<MemberSelection>(null);
  const [selectedRole, setSelectedRole] = useState<ExperimentMemberRole>("member");
  const [debouncedSearch, isDebounced] = useDebounce(userSearch, 300);
  const { data: userSearchData, isLoading: isFetchingUsers } = useUserSearch(debouncedSearch);

  const { mutateAsync: addMember, isPending: isAddingMember } = useExperimentMemberAdd();
  const { mutateAsync: removeMember, isPending: isRemovingMember } = useExperimentMemberRemove();
  const { mutateAsync: createInvitations, isPending: isCreatingInvitation } =
    useUserInvitationCreate();
  const { mutate: revokeInvitation } = useUserInvitationRevoke();
  const { mutate: updateInvitationRole } = useUserInvitationRoleUpdate();
  const { data: invitationsData } = useUserInvitations("experiment", experimentId);
  const invitations: Invitation[] = invitationsData?.body ?? [];

  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const selectedUser = selection?.type === "user" ? selection.user : null;
  const selectedEmail = selection?.type === "email" ? selection.email : null;

  const isAddingMembersDisabled =
    !selection ||
    isAddingMember ||
    isCreatingInvitation ||
    currentUserRole !== "admin" ||
    isArchived;

  // Safely extract available users and filter out existing members
  const availableUsers = useMemo(() => {
    if (userSearchData?.body && Array.isArray(userSearchData.body)) {
      return userSearchData.body.filter((user) => !members.some((m) => m.user.id === user.userId));
    }
    return [];
  }, [userSearchData, members]);

  const resetSelection = () => {
    setUserSearch("");
    setSelection(null);
    setSelectedRole("member");
  };

  // Handle adding a member by userId or inviting by email
  const handleAddMember = async () => {
    if (!selection) return;

    if (selection.type === "user") {
      await addMember({
        params: { id: experimentId },
        body: { members: [{ userId: selection.user.userId, role: selectedRole }] },
      });
      toast({ description: t("experimentSettings.memberAdded") });
    } else {
      await createInvitations({
        body: {
          invitations: [
            {
              resourceType: "experiment",
              resourceId: experimentId,
              email: selection.email,
              role: selectedRole,
            },
          ],
        },
      });
      toast({ description: t("experimentSettings.invitationSent") });
    }

    resetSelection();
  };

  // Handle removing a member
  const handleRemoveMember = async (memberId: string) => {
    setRemovingMemberId(memberId);

    try {
      await removeMember({
        params: {
          id: experimentId,
          memberId,
        },
      });

      toast({ description: t("experimentSettings.memberRemoved") });
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleInvitationValueChange = (value: string, invitation: Invitation) => {
    if (value === "revoke") {
      revokeInvitation(
        { params: { invitationId: invitation.id } },
        {
          onSuccess: () => {
            toast({ description: t("experimentSettings.invitationRevoked") });
          },
        },
      );
    } else {
      updateInvitationRole(
        {
          params: { invitationId: invitation.id },
          body: { role: value as ExperimentMemberRole },
        },
        {
          onSuccess: () => {
            toast({ description: t("experimentSettings.roleUpdated") });
          },
        },
      );
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle>{t("experimentSettings.memberManagement")}</CardTitle>
          <div className="bg-muted/40 h-6 w-32 rounded" />
        </CardHeader>
        <CardContent>
          <div className="bg-muted/40 h-64 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>{t("experimentSettings.memberManagement")}</CardTitle>
          <CardDescription className="text-destructive">
            {t("experimentSettings.memberManagementError")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle>{t("experimentSettings.collaborators")}</CardTitle>
        <CardDescription>{t("experimentSettings.collaboratorsDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Add member section */}
        <div className="flex gap-2">
          <UserSearchPopover
            availableUsers={availableUsers}
            searchValue={userSearch}
            onSearchChange={setUserSearch}
            isAddingUser={isAddingMember}
            loading={!isDebounced || isFetchingUsers}
            onSelectUser={(user) => setSelection({ type: "user", user })}
            onSelectEmail={(email) => setSelection({ type: "email", email })}
            placeholder={t("experiments.searchUsersPlaceholder")}
            selectedUser={selectedUser}
            selectedEmail={selectedEmail}
            onClearSelection={() => setSelection(null)}
            disabled={isArchived || currentUserRole !== "admin"}
            selectedRole={selectedRole}
            onRoleChange={(val) => setSelectedRole(val as ExperimentMemberRole)}
          />
          <Button
            onClick={handleAddMember}
            variant="muted"
            disabled={isAddingMembersDisabled}
            size="default"
          >
            {t("common.add")}
          </Button>
        </div>

        {/* Current members section */}
        <div>
          <MemberList
            membersWithUserInfo={members.map((member) => ({
              ...member,
              user: {
                userId: member.user.id,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                email: member.user.email,
                bio: null,
                activated: null,
                organization: undefined,
              },
            }))}
            onRemoveMember={handleRemoveMember}
            isRemovingMember={isRemovingMember}
            removingMemberId={removingMemberId}
            adminCount={adminCount}
            experimentId={experimentId}
            currentUserRole={currentUserRole}
            currentUserId={session?.user.id ?? ""}
            isArchived={isArchived}
          />
        </div>

        {/* Pending invitations section */}
        {invitations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-foreground font-semibold">
              {t("experimentSettings.pendingInvitations")}
            </h4>
            <div className="max-h-[120px] space-y-3 overflow-y-auto pr-2">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between rounded">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-foreground text-sm font-medium">{invitation.email}</span>
                  </div>
                  <div className="flex flex-shrink-0 pl-4">
                    <Select
                      value={invitation.role}
                      disabled={isArchived || currentUserRole !== "admin"}
                      onValueChange={(value) => handleInvitationValueChange(value, invitation)}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{t("experimentSettings.roleAdmin")}</SelectItem>
                        <SelectItem value="member">{t("experimentSettings.roleMember")}</SelectItem>
                        <div className="my-1 border-t" />
                        <SelectItem
                          value="revoke"
                          className="text-destructive focus:text-destructive"
                        >
                          {t("experimentSettings.revoke")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </>
  );
}
