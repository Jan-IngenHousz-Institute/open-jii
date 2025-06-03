"use client";

import { formatDate } from "@/util/date";
import { UserPlus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { User } from "@repo/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SearchInput,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentMemberAdd } from "../hooks/experiment/useExperimentMemberAdd/useExperimentMemberAdd";
import { useExperimentMemberRemove } from "../hooks/experiment/useExperimentMemberRemove/useExperimentMemberRemove";
import { useExperimentMembers } from "../hooks/experiment/useExperimentMembers/useExperimentMembers";
import { useDebounce } from "../hooks/useDebounce";
import { useUserSearch } from "../hooks/useUserSearch";

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

  // User search with debounced input
  const [userSearch, setUserSearch] = useState("");
  const debouncedSearch = useDebounce(userSearch, 300);
  const { data: userSearchData, isLoading: isUsersLoading } =
    useUserSearch(debouncedSearch);

  // Add/remove member mutations
  const { mutateAsync: addMember, isPending: isAddingMember } =
    useExperimentMemberAdd();
  const { mutateAsync: removeMember, isPending: isRemovingMember } =
    useExperimentMemberRemove();

  // UI state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Handle adding a member
  const handleAddMember = async () => {
    if (!selectedUserId) return;

    await addMember({
      params: { id: experimentId },
      body: {
        userId: selectedUserId,
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
          <CardDescription>Loading members...</CardDescription>
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

  const members = membersData?.body ?? [];
  const adminCount = members.filter((m) => m.role === "admin").length;

  // Safely extract available users and filter out existing members
  let availableUsers: User[] = [];
  if (userSearchData?.body && Array.isArray(userSearchData.body)) {
    availableUsers = userSearchData.body.filter(
      (user) => !members.some((m) => m.userId === user.id),
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
          <h6 className="text-sm font-medium">Add a Member</h6>
          <div className="flex flex-col space-y-2">
            <SearchInput
              value={userSearch}
              onChange={setUserSearch}
              placeholder="Search users by name or email..."
              isLoading={isUsersLoading}
              clearable={true}
            />

            {userSearch.length > 0 && (
              <div className="flex space-x-2">
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={availableUsers.length === 0}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue
                      placeholder={
                        availableUsers.length === 0
                          ? "No users available"
                          : "Select user..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length === 0 ? (
                      <SelectItem value="no-users-available" disabled>
                        No users available to add
                      </SelectItem>
                    ) : (
                      availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name ?? "Unnamed User"}{" "}
                          <span className="text-muted-foreground text-xs">
                            ({user.email ?? "No email"})
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddMember}
                  disabled={
                    isAddingMember ||
                    !selectedUserId ||
                    availableUsers.length === 0
                  }
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {isAddingMember ? "Adding..." : "Add"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Current members section */}
        <div>
          <h6 className="mb-2 text-sm font-medium">Current Members</h6>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No members added yet
            </p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const user = getUserInfo(member.userId);
                const isLastAdmin = member.role === "admin" && adminCount === 1;
                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex flex-col">
                      <span>
                        {user.name ?? "Unknown User"}{" "}
                        <span className="text-muted-foreground text-xs">
                          {user.email ?? "No email"}
                        </span>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        Joined {formatDate(member.joinedAt)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge>{member.role}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.userId)}
                        disabled={
                          (isRemovingMember &&
                            removingMemberId === member.userId) ||
                          isLastAdmin
                        }
                        title={
                          isLastAdmin
                            ? "Cannot remove the last admin"
                            : "Remove member"
                        }
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
