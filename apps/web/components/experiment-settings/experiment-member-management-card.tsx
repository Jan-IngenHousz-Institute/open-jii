"use client";

import { useMemo, useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentMemberAdd } from "../../hooks/experiment/useExperimentMemberAdd/useExperimentMemberAdd";
import { useExperimentMemberRemove } from "../../hooks/experiment/useExperimentMemberRemove/useExperimentMemberRemove";
import { useExperimentMembers } from "../../hooks/experiment/useExperimentMembers/useExperimentMembers";
import { useDebounce } from "../../hooks/useDebounce";
import { useUserSearch } from "../../hooks/useUserSearch";
import { MemberList } from "../current-members-list/current-members-list";
import { UserSearchWithDropdown } from "../user-search-with-dropdown";

interface ExperimentMemberManagementProps {
  experimentId: string;
}

export function ExperimentMemberManagement({ experimentId }: ExperimentMemberManagementProps) {
  const { t } = useTranslation();
  // Get experiment members
  const {
    data: membersData,
    isLoading: isMembersLoading,
    isError: isMembersError,
  } = useExperimentMembers(experimentId);

  const members = useMemo(() => {
    return membersData?.body ?? [];
  }, [membersData]);

  const adminCount = useMemo(() => {
    return members.filter((m) => m.role === "admin").length;
  }, [members]);

  // User search with debounced input
  const [userSearch, setUserSearch] = useState("");
  const [debouncedSearch, isDebounced] = useDebounce(userSearch, 300);
  const { data: userSearchData, isLoading: isFetchingUsers } = useUserSearch(debouncedSearch);

  // Add/remove member mutations
  const { mutateAsync: addMember, isPending: isAddingMember } = useExperimentMemberAdd();
  const { mutateAsync: removeMember, isPending: isRemovingMember } = useExperimentMemberRemove();

  // UI state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Safely extract available users and filter out existing members
  const availableUsers = useMemo(() => {
    if (userSearchData?.body && Array.isArray(userSearchData.body)) {
      return userSearchData.body.filter((user) => !members.some((m) => m.user.id === user.userId));
    }
    return [];
  }, [userSearchData, members]);

  // Handle adding a member
  const handleAddMember = async (userId?: string) => {
    const idToAdd = userId ?? selectedUserId;
    if (!idToAdd) return;

    await addMember({
      params: { id: experimentId },
      body: {
        members: [
          {
            userId: idToAdd,
            role: "member",
          },
        ],
      },
    });

    toast({ description: t("experimentSettings.memberAdded") });
    setSelectedUserId("");
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

  if (isMembersLoading) {
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

  if (isMembersError) {
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
    <Card>
      <CardHeader>
        <CardTitle>{t("experimentSettings.memberManagement")}</CardTitle>
        <CardDescription>{t("experimentSettings.memberDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add member section */}
        <UserSearchWithDropdown
          availableUsers={availableUsers}
          value={selectedUserId}
          onValueChange={setSelectedUserId}
          placeholder={t("newExperiment.addMembersTitle")}
          loading={!isDebounced || isFetchingUsers}
          searchValue={userSearch}
          onSearchChange={setUserSearch}
          onAddUser={handleAddMember}
          isAddingUser={isAddingMember}
        />
        {/* Current members section */}
        <div>
          <h6 className="mb-2 text-sm font-medium">{t("experimentSettings.currentMembers")}</h6>
          <MemberList
            membersWithUserInfo={members.map((member) => ({
              ...member,
              user: {
                userId: member.user.id,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                email: member.user.email,
                bio: null,
                organization: undefined,
              },
            }))}
            onRemoveMember={handleRemoveMember}
            isRemovingMember={isRemovingMember}
            removingMemberId={removingMemberId}
            adminCount={adminCount}
          />
        </div>
      </CardContent>
    </Card>
  );
}
