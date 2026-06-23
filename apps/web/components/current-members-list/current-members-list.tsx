import { useLocale } from "@/hooks/useLocale";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { ExperimentMemberRole } from "@repo/api/domains/experiment/experiment.schema";
import type { UserProfile } from "@repo/api/domains/user/user.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { useExperimentMemberRoleUpdate } from "../../hooks/experiment/useExperimentMemberRoleUpdate/useExperimentMemberRoleUpdate";
import { MemberDialogs } from "./member-dialogs";
import { MemberItem } from "./member-item";

interface MemberWithUserInfo {
  role: string;
  joinedAt: string;
  user: UserProfile;
}

interface MemberListProps {
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
  isAddingMember?: boolean;
}

export function MemberList({
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
  isAddingMember = false,
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

  const membersWithUserInfo = useMemo(() => {
    return [...(providedMembersWithUserInfo ?? [])].sort((a, b) => {
      if (a.user.userId === currentUserId) return -1;
      if (b.user.userId === currentUserId) return 1;
      return 0;
    });
  }, [providedMembersWithUserInfo, currentUserId]);

  if (membersWithUserInfo.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
          <Users className="h-5 w-5" />
        </div>
        <p className="text-foreground text-sm font-semibold">
          {t("experimentSettings.noMembersYet")}
        </p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-[280px] text-xs leading-relaxed">
          {t("experimentSettings.addCollaborators")}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
        {membersWithUserInfo.map((member) => {
          const isLastAdmin = member.role === "admin" && adminCount === 1;
          const isCurrentUser = member.user.userId === currentUserId;
          const isOptimistic =
            isAddingMember && member.user.firstName === "" && member.user.lastName === "";

          if (isOptimistic) {
            return (
              <div key={member.user.userId} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-9 w-[100px]" />
              </div>
            );
          }

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
