import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { UserProfile, ExperimentMemberRole } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks";

import { useExperimentMemberRoleUpdate } from "../../hooks/experiment/useExperimentMemberRoleUpdate/useExperimentMemberRoleUpdate";
import { MemberDialogs } from "./member-dialogs";
import { MemberItem } from "./member-item";

interface MemberWithUserInfo {
  role: string;
  joinedAt: string;
  user: UserProfile;
}

interface Member {
  userId: string;
  role?: "admin" | "member";
}

interface MemberListProps {
  // Accept either ready-made formatted membersWithUserInfo or raw members with users
  members?: Member[];
  users?: UserProfile[];
  membersWithUserInfo?: MemberWithUserInfo[];
  onRemoveMember: (memberId: string) => void;
  isRemovingMember: boolean;
  removingMemberId: string | null;
  adminCount?: number;
  experimentId?: string;
  currentUserRole?: ExperimentMemberRole;
  currentUserId?: string;
  newExperiment?: boolean;
  onUpdateMemberRole?: (userId: string, role: ExperimentMemberRole) => Promise<void> | void;
  isArchived?: boolean;
}

export function MemberList({
  members,
  users,
  membersWithUserInfo: providedMembersWithUserInfo,
  onRemoveMember,
  isRemovingMember,
  removingMemberId,
  adminCount = 0,
  experimentId,
  currentUserRole = "member",
  currentUserId,
  newExperiment = false,
  onUpdateMemberRole,
  isArchived = false,
}: MemberListProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = useLocale();
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [showLastAdminDialog, setShowLastAdminDialog] = useState(false);
  const [lastAdminAction, setLastAdminAction] = useState<"leave" | "demote">("leave");
  const [showLeaveConfirmDialog, setShowLeaveConfirmDialog] = useState(false);
  const [showDemoteConfirmDialog, setShowDemoteConfirmDialog] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const { mutate: updateMemberRole } = useExperimentMemberRoleUpdate();
  const isCurrentUserAdmin = currentUserRole === "admin";

  // Handle role change
  const handleRoleChange = async (
    userId: string,
    newRole: ExperimentMemberRole,
    isLastAdmin: boolean,
  ) => {
    // Check if last admin is trying to demote themselves to member
    if (isLastAdmin && userId === currentUserId && newRole === "member") {
      setLastAdminAction("demote");
      setShowLastAdminDialog(true);
      return;
    }

    // Check if current user is trying to demote themselves to member
    if (userId === currentUserId && newRole === "member" && currentUserRole === "admin") {
      setPendingUserId(userId);
      setShowDemoteConfirmDialog(true);
      return;
    }

    await performRoleChange(userId, newRole);
  };

  // Perform the actual role change
  const performRoleChange = async (userId: string, newRole: ExperimentMemberRole) => {
    if (newExperiment && onUpdateMemberRole) {
      setUpdatingMemberId(userId);
      await onUpdateMemberRole(userId, newRole);
      setUpdatingMemberId(null);

      return;
    }

    if (!experimentId) return;

    setUpdatingMemberId(userId);
    updateMemberRole(
      {
        params: { id: experimentId, memberId: userId },
        body: { role: newRole },
      },
      {
        onSuccess: () => {
          toast({ description: t("experimentSettings.roleUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
        onSettled: () => {
          setUpdatingMemberId(null);
        },
      },
    );
  };

  // Handle confirmed demotion
  const handleConfirmDemote = async () => {
    if (pendingUserId) {
      setShowDemoteConfirmDialog(false);
      await performRoleChange(pendingUserId, "member");
      setPendingUserId(null);
    }
  };

  // Handle confirmed leave
  const handleConfirmLeave = () => {
    if (pendingUserId) {
      setShowLeaveConfirmDialog(false);
      onRemoveMember(pendingUserId);
      setPendingUserId(null);

      // Redirect to experiments page after leaving
      router.push(`/${locale}/platform/experiments`);
    }
  };

  // Handle value change for member role/action selection
  const handleMemberValueChange = async (
    userId: string,
    value: string,
    isLastAdmin: boolean,
    isCurrentUser: boolean,
  ) => {
    if (value === "leave") {
      // If user is last admin, show warning dialog
      if (isLastAdmin && isCurrentUser) {
        setLastAdminAction("leave");
        setShowLastAdminDialog(true);
      } else if (isCurrentUser) {
        // Show confirmation dialog for leaving
        setPendingUserId(userId);
        setShowLeaveConfirmDialog(true);
      } else {
        onRemoveMember(userId);
      }
    } else if (value === "remove") {
      onRemoveMember(userId);
    } else {
      await handleRoleChange(userId, value as ExperimentMemberRole, isLastAdmin);
    }
  };

  // Convert members and users to membersWithUserInfo if needed
  const membersWithUserInfo = useMemo(() => {
    const baseMembers = providedMembersWithUserInfo
      ? [...providedMembersWithUserInfo]
      : (members ?? []).map((member) => {
          const user = users?.find((u) => u.userId === member.userId) ?? {
            userId: member.userId,
            firstName: "",
            lastName: "",
            email: null,
            bio: null,
            organization: undefined,
          };

          return {
            role: member.role ?? "member",
            joinedAt: new Date().toISOString(),
            user,
          };
        });

    // Sort so current user appears first
    return baseMembers.sort((a, b) => {
      if (a.user.userId === currentUserId) return -1;
      if (b.user.userId === currentUserId) return 1;
      return 0;
    });
  }, [providedMembersWithUserInfo, members, users, currentUserId]);

  if (membersWithUserInfo.length === 0) {
    return (
      <div className="border-muted flex flex-col items-center justify-center py-4">
        <p className="text-muted-foreground text-base font-medium">
          {t("experimentSettings.noMembersYet")}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {t("experimentSettings.addCollaborators")}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="max-h-[200px] space-y-3 overflow-y-auto pr-2">
        {membersWithUserInfo.map((member) => {
          const isLastAdmin = member.role === "admin" && adminCount === 1;
          const isCurrentUser = member.user.userId === currentUserId;

          return (
            <MemberItem
              key={member.user.userId}
              member={member}
              isLastAdmin={isLastAdmin}
              currentUserId={currentUserId}
              isCurrentUserAdmin={isCurrentUserAdmin}
              updatingMemberId={updatingMemberId}
              experimentId={experimentId}
              newExperiment={newExperiment}
              isRemovingMember={isRemovingMember}
              removingMemberId={removingMemberId}
              onValueChange={(value) =>
                handleMemberValueChange(member.user.userId, value, isLastAdmin, isCurrentUser)
              }
              isArchived={isArchived}
            />
          );
        })}
      </div>

      <MemberDialogs
        showLastAdminDialog={showLastAdminDialog}
        showLeaveConfirmDialog={showLeaveConfirmDialog}
        showDemoteConfirmDialog={showDemoteConfirmDialog}
        lastAdminAction={lastAdminAction}
        onLastAdminDialogChange={setShowLastAdminDialog}
        onLeaveConfirmDialogChange={setShowLeaveConfirmDialog}
        onDemoteConfirmDialogChange={setShowDemoteConfirmDialog}
        onConfirmLeave={handleConfirmLeave}
        onConfirmDemote={handleConfirmDemote}
      />
    </>
  );
}
