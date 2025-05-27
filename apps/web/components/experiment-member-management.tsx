"use client";

import { useState } from "react";
import { UserPlus, Trash2 } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Badge,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentMembers } from "../hooks/experiment/useExperimentMembers/useExperimentMembers";
import { useExperimentMemberAdd } from "../hooks/experiment/useExperimentMemberAdd/useExperimentMemberAdd";
import { useExperimentMemberRemove } from "../hooks/experiment/useExperimentMemberRemove/useExperimentMemberRemove";

interface ExperimentMemberManagementProps {
  experimentId: string;
}

export function ExperimentMemberManagement({
  experimentId,
}: ExperimentMemberManagementProps) {
  const { data: membersData, isLoading, isError } = useExperimentMembers(experimentId);
  const { mutateAsync: addMember, isPending: isAddingMember } = useExperimentMemberAdd();
  const { mutateAsync: removeMember, isPending: isRemovingMember } = useExperimentMemberRemove();
  
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    try {
      await addMember({
        params: { id: experimentId },
        body: {
          userId: newMemberEmail,
          role: "member",
        },
      });

      toast({
        description: "Member added successfully",
      });

      setNewMemberEmail("");
    } catch {
      toast({
        title: "Error",
        description: "Failed to add member",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMemberId(memberId);
    
    try {
      await removeMember({
        params: { 
          id: experimentId,
          memberId,
        },
      });

      toast({
        description: "Member removed successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    } finally {
      setRemovingMemberId(null);
    }
  };

  if (isLoading) {
    return <div>Loading members...</div>;
  }

  if (isError) {
    return <div>Error loading members</div>;
  }

  const members = membersData?.body ?? [];

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
            <Input
              type="email"
              placeholder="Enter email address"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleAddMember} 
              disabled={isAddingMember || !newMemberEmail.trim()}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {isAddingMember ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>

        <div>
          <h6 className="mb-2 text-sm font-medium">Current Members</h6>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No members added yet</p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex flex-col">
                    <span>{member.userId}</span>
                    <span className="text-xs text-muted-foreground">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge>{member.role}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.userId)}
                      disabled={isRemovingMember && removingMemberId === member.userId}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
