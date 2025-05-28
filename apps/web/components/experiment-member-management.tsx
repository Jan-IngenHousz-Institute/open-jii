"use client";

import { UserPlus, Trash2 } from "lucide-react";
import { useState } from "react";

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
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentMemberAdd } from "../hooks/experiment/useExperimentMemberAdd/useExperimentMemberAdd";
import { useExperimentMemberRemove } from "../hooks/experiment/useExperimentMemberRemove/useExperimentMemberRemove";
import { useExperimentMembers } from "../hooks/experiment/useExperimentMembers/useExperimentMembers";
import { useUsersNotOnExperiment } from "../hooks/experiment/useUsersNotOnExperiment/useUsersNotOnExperiment";

interface ExperimentMemberManagementProps {
  experimentId: string;
}

export function ExperimentMemberManagement({
  experimentId,
}: ExperimentMemberManagementProps) {
  const {
    data: membersData,
    isLoading,
    isError,
  } = useExperimentMembers(experimentId);

  const { data: availableUsersData, isLoading: isLoadingUsers } =
    useUsersNotOnExperiment(experimentId);

  const { mutateAsync: addMember, isPending: isAddingMember } =
    useExperimentMemberAdd();

  const { mutateAsync: removeMember, isPending: isRemovingMember } =
    useExperimentMemberRemove();

  const [selectedUserId, setSelectedUserId] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const handleAddMember = async () => {
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

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMemberId(memberId);

    await removeMember({
      params: {
        id: experimentId,
        memberId,
      },
    });

    toast({
      description: "Member removed successfully",
    });

    setRemovingMemberId(null);
  };

  if (isLoading || isLoadingUsers) {
    return <div>Loading members...</div>;
  }

  if (isError) {
    return <div>Error loading members</div>;
  }

  const members = membersData?.body ?? [];
  const adminCount = members.filter((m) => m.role === "admin").length;
  const availableUsers = availableUsersData?.body ?? [];

  // Helper to get user info from available users
  const getUserInfo = (userId: string) =>
    availableUsers.find((u) => u.id === userId) ?? {
      id: userId,
      name: userId,
      email: "",
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
        <div className="space-y-2">
          <h6 className="text-sm font-medium">Add a Member</h6>
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
                  <SelectItem value="" disabled>
                    No users available to add
                  </SelectItem>
                ) : (
                  availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}{" "}
                      <span className="text-muted-foreground text-xs">
                        ({user.email})
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAddMember}
              disabled={
                isAddingMember || !selectedUserId || availableUsers.length === 0
              }
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {isAddingMember ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>

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
                        {user.name}{" "}
                        <span className="text-muted-foreground text-xs">
                          {user.email}
                        </span>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
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
