"use client";

import { useMemo, useState } from "react";

import type { User } from "@repo/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentMemberAdd } from "../../hooks/experiment/useExperimentMemberAdd/useExperimentMemberAdd";
import { useExperimentMemberRemove } from "../../hooks/experiment/useExperimentMemberRemove/useExperimentMemberRemove";
import { useExperimentMembers } from "../../hooks/experiment/useExperimentMembers/useExperimentMembers";
import { useDebounce } from "../../hooks/useDebounce";
import { useUserSearch } from "../../hooks/useUserSearch";
import { MemberList } from "../current-members-list";
import { UserSearchWithDropdown } from "../user-search-with-dropdown";

interface ExperimentMemberManagementProps {
  experimentId: string;
}

export function ExperimentMemberManagement({ experimentId }: ExperimentMemberManagementProps) {
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
      return userSearchData.body.filter((user) => !members.some((m) => m.user.id === user.id));
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
  // Helper to get user info from member.user if present, then availableUsers, then fallback to user.id
  const getUserInfo = (member: {
    user: { id: string; name?: string | null; email?: string | null };
  }): User => {
    if (typeof member.user.name === "string") {
      return {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email ?? "",
        emailVerified: null,
        image: null,
        createdAt: "",
        registered: true,
      };
    }
    const foundUser = availableUsers.find((u) => u.id === member.user.id);
    if (foundUser) {
      return foundUser;
    }
    return {
      id: member.user.id,
      name: "Loading user info...",
      email: "",
      emailVerified: null,
      image: null,
      createdAt: "",
      registered: true,
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Member Management</CardTitle>
        <CardDescription>Manage who has access to this experiment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add member section */}

        <UserSearchWithDropdown
          availableUsers={availableUsers}
          value={selectedUserId}
          onValueChange={setSelectedUserId}
          placeholder="Add a member"
          loading={!isDebounced || isFetchingUsers}
          searchValue={userSearch}
          onSearchChange={setUserSearch}
          onAddUser={handleAddMember}
          isAddingUser={isAddingMember}
        />
        {/* Current members section */}
        <div>
          <h6 className="mb-2 text-sm font-medium">Current Members</h6>
          <MemberList
            membersWithUserInfo={members.map((member) => ({
              ...member,
              user: getUserInfo(member),
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
