"use client";

import { useMemo, useState } from "react";

import type { ExperimentMember, ExperimentMemberRole } from "@repo/api/schemas/experiment.schema";
import type { Invitation, UserProfile } from "@repo/api/schemas/user.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

import { useExperimentMemberAdd } from "../../../hooks/experiment/useExperimentMemberAdd/useExperimentMemberAdd";
import { useExperimentMemberRemove } from "../../../hooks/experiment/useExperimentMemberRemove/useExperimentMemberRemove";
import { useDebounce } from "../../../hooks/useDebounce";
import { useUserSearch } from "../../../hooks/useUserSearch";
import { useUserInvitationCreate } from "../../../hooks/user-invitation/useUserInvitationCreate/useUserInvitationCreate";
import { MemberList } from "../../current-members-list/current-members-list";
import { UserSearchPopover } from "../../user-search-popover";

type MemberSelection =
  | { type: "user"; user: UserProfile }
  | { type: "email"; email: string }
  | null;

interface ExperimentMembersPanelProps {
  experimentId: string;
  members: ExperimentMember[];
  invitations: Invitation[];
  currentUserRole: ExperimentMemberRole | undefined;
  currentUserId: string;
  isArchived: boolean;
  adminCount: number;
}

export function ExperimentMembersPanel({
  experimentId,
  members,
  invitations,
  currentUserRole,
  currentUserId,
  isArchived,
  adminCount,
}: ExperimentMembersPanelProps) {
  const { t } = useTranslation();

  const [userSearch, setUserSearch] = useState("");
  const [selection, setSelection] = useState<MemberSelection>(null);
  const [selectedRole, setSelectedRole] = useState<ExperimentMemberRole>("member");
  const [debouncedSearch, isDebounced] = useDebounce(userSearch, 300);
  const { data: userSearchData, isLoading: isFetchingUsers } = useUserSearch(debouncedSearch);

  const { mutateAsync: addMember, isPending: isAddingMember } = useExperimentMemberAdd();
  const { mutateAsync: removeMember, isPending: isRemovingMember } = useExperimentMemberRemove();
  const { mutateAsync: createInvitation, isPending: isCreatingInvitation } =
    useUserInvitationCreate();

  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const selectedUser = selection?.type === "user" ? selection.user : null;
  const selectedEmail = selection?.type === "email" ? selection.email : null;

  const isAddingMembersDisabled =
    !selection ||
    isAddingMember ||
    isCreatingInvitation ||
    currentUserRole !== "admin" ||
    isArchived;

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

  const handleAddMember = async () => {
    if (!selection) return;

    if (selection.type === "user") {
      await addMember(
        {
          params: { id: experimentId },
          body: { members: [{ userId: selection.user.userId, role: selectedRole }] },
        },
        {
          onSuccess: () => {
            toast({ description: t("experimentSettings.memberAdded") });
          },
        },
      );
    } else {
      await createInvitation(
        {
          body: {
            resourceType: "experiment",
            resourceId: experimentId,
            email: selection.email,
            role: selectedRole,
          },
        },
        {
          onSuccess: () => {
            toast({ description: t("experimentSettings.invitationSent") });
          },
        },
      );
    }

    resetSelection();
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMemberId(memberId);
    try {
      await removeMember(
        { params: { id: experimentId, memberId } },
        {
          onSuccess: () => {
            toast({ description: t("experimentSettings.memberRemoved") });
          },
        },
      );
    } finally {
      setRemovingMemberId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex w-full items-center gap-2">
        <div className="min-w-0 flex-1">
          <UserSearchPopover
            availableUsers={availableUsers}
            searchValue={userSearch}
            onSearchChange={setUserSearch}
            isAddingUser={isAddingMember || isCreatingInvitation}
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
            existingEmails={[
              ...members.map((m) => m.user.email).filter((e): e is string => e != null),
              ...invitations.map((inv) => inv.email),
            ]}
          />
        </div>
        <Button
          onClick={handleAddMember}
          variant="muted"
          disabled={isAddingMembersDisabled}
          size="default"
          className="ml-auto shrink-0"
        >
          {t("common.add")}
        </Button>
      </div>

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
            avatarUrl: member.user.avatarUrl,
          },
        }))}
        onRemoveMember={handleRemoveMember}
        isAddingMember={isAddingMember}
        isRemovingMember={isRemovingMember}
        removingMemberId={removingMemberId}
        adminCount={adminCount}
        experimentId={experimentId}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        isArchived={isArchived}
      />
    </div>
  );
}
