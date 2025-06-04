"use client";

import { formatDate } from "@/util/date";
import { useMemo, useState } from "react";

import type { User } from "@repo/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentMemberAdd } from "../hooks/experiment/useExperimentMemberAdd/useExperimentMemberAdd";
import { useExperimentMemberRemove } from "../hooks/experiment/useExperimentMemberRemove/useExperimentMemberRemove";
import { useExperimentMembers } from "../hooks/experiment/useExperimentMembers/useExperimentMembers";
import { useDebounce } from "../hooks/useDebounce";
import { useUserSearch } from "../hooks/useUserSearch";
import { MemberList } from "./current-members-list";
import { UserSearchWithDropdown } from "./user-search-with-dropdown";

interface ExperimentMemberManagementProps {
  experimentId: string;
}

export function ExperimentMemberManagement({
  experimentId,
}: ExperimentMemberManagementProps) {
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
  const debouncedSearch = useDebounce(userSearch, 300);
  const { data: userSearchData, isFetched: isFetchingUsers } =
    useUserSearch(debouncedSearch);

  // Add/remove member mutations
  const { mutateAsync: addMember, isPending: isAddingMember } =
    useExperimentMemberAdd();
  const { mutateAsync: removeMember, isPending: isRemovingMember } =
    useExperimentMemberRemove();

  // UI state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Safely extract available users and filter out existing members
  const availableUsers = useMemo(() => {
    if (userSearchData?.body && Array.isArray(userSearchData.body)) {
      return userSearchData.body.filter(
        (user) => !members.some((m) => m.userId === user.id),
      );
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
        userId: idToAdd,
        role: "member",
      },
    });

    toast({ description: "Member added successfully" });
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

      toast({ description: "Member removed successfully" });
    } finally {
      setRemovingMemberId(null);
    }
  };

  if (isMembersLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle>Member Management</CardTitle>
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
          <CardTitle>Member Management</CardTitle>
          <CardDescription className="text-destructive">
            Error loading members. Please try again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Helper to get user info from available users or provide default values
  const getUserInfo = (userId: string): User => {
    // First try to find the user in the available users list
    const foundUser = availableUsers.find((u) => u.id === userId);
    if (foundUser) return foundUser;

    // If not found, return a default user object with the ID
    return {
      id: userId,
      name: userId,
      email: "",
      emailVerified: null,
      image: null,
      createdAt: "",
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Member Management</CardTitle>
        <CardDescription>
          Manage who has access to this experiment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add member section */}
        <div className="space-y-2">
          <div className="flex flex-col space-y-2">
            <UserSearchWithDropdown
              availableUsers={availableUsers}
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              placeholder="Add a member"
              loading={isFetchingUsers}
              searchValue={userSearch}
              onSearchChange={setUserSearch}
              onAddUser={handleAddMember}
              isAddingUser={isAddingMember}
            />
          </div>
        </div>

        {/* Current members section */}
        <div>
          <h6 className="mb-2 text-sm font-medium">Current Members</h6>
          <MemberList
            membersWithUserInfo={members.map((member) => ({
              ...member,
              user: {
                name: getUserInfo(member.userId).name,
                email: getUserInfo(member.userId).email,
              },
            }))}
            formatDate={formatDate}
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
