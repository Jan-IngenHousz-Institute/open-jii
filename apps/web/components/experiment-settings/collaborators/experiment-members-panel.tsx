"use client";

import { useState } from "react";

import type {
  ExperimentMember,
  ExperimentMemberRole,
} from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

import { useExperimentMemberRemove } from "../../../hooks/experiment/useExperimentMemberRemove/useExperimentMemberRemove";
import { MemberList } from "../../current-members-list/current-members-list";

interface ExperimentMembersPanelProps {
  experimentId: string;
  members: ExperimentMember[];
  currentUserRole: ExperimentMemberRole | undefined;
  currentUserId: string;
  isArchived: boolean;
  adminCount: number;
  isAddingMember?: boolean;
}

export function ExperimentMembersPanel({
  experimentId,
  members,
  currentUserRole,
  currentUserId,
  isArchived,
  adminCount,
  isAddingMember = false,
}: ExperimentMembersPanelProps) {
  const { t } = useTranslation();
  const { mutateAsync: removeMember, isPending: isRemovingMember } = useExperimentMemberRemove();
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

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
  );
}
