"use client";

import { useMemo, useState } from "react";

import type { UserProfile, ExperimentMemberRole, ExperimentMember } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentMemberAdd } from "../../hooks/experiment/useExperimentMemberAdd/useExperimentMemberAdd";
import { useExperimentMemberRemove } from "../../hooks/experiment/useExperimentMemberRemove/useExperimentMemberRemove";
import { useDebounce } from "../../hooks/useDebounce";
import { useUserSearch } from "../../hooks/useUserSearch";
import { MemberList } from "../current-members-list/current-members-list";
import { UserSearchPopover } from "../user-search-popover";

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
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<ExperimentMemberRole>("member");
  const [debouncedSearch, isDebounced] = useDebounce(userSearch, 300);
  const { data: userSearchData, isLoading: isFetchingUsers } = useUserSearch(debouncedSearch);

  // Add/remove member mutations
  const { mutateAsync: addMember, isPending: isAddingMember } = useExperimentMemberAdd();
  const { mutateAsync: removeMember, isPending: isRemovingMember } = useExperimentMemberRemove();

  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Safely extract available users and filter out existing members
  const availableUsers = useMemo(() => {
    if (userSearchData?.body && Array.isArray(userSearchData.body)) {
      return userSearchData.body.filter((user) => !members.some((m) => m.user.id === user.userId));
    }
    return [];
  }, [userSearchData, members]);

  // Handle adding a member
  const handleAddMember = async () => {
    if (!selectedUser) return;

    await addMember({
      params: { id: experimentId },
      body: {
        members: [
          {
            userId: selectedUser.userId,
            role: selectedRole,
          },
        ],
      },
    });

    toast({ description: t("experimentSettings.memberAdded") });

    // Reset search and selection
    setUserSearch("");
    setSelectedUser(null);
    setSelectedRole("member");
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
        <CardTitle>Collaborators</CardTitle>
        <CardDescription>Manage who has access to this experiment</CardDescription>
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
            onSelectUser={setSelectedUser}
            placeholder="Enter name or email..."
            selectedUser={selectedUser}
            onClearSelection={() => setSelectedUser(null)}
            disabled={isArchived || currentUserRole !== "admin"}
            selectedRole={selectedRole}
            onRoleChange={(val) => setSelectedRole(val as ExperimentMemberRole)}
          />
          <Button
            onClick={handleAddMember}
            variant="outline"
            disabled={!selectedUser || isAddingMember || currentUserRole !== "admin" || isArchived}
            size="default"
            className="bg-surface-dark"
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
      </CardContent>
    </>
  );
}
