import { formatDate } from "@/util/date";
import { Trash2, Mail, Calendar } from "lucide-react";
import { useMemo, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { UserProfile, ExperimentMemberRole } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentMemberRoleUpdate } from "../../hooks/experiment/useExperimentMemberRoleUpdate/useExperimentMemberRoleUpdate";

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
}: MemberListProps) {
  const { t } = useTranslation();
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const { mutateAsync: updateMemberRole } = useExperimentMemberRoleUpdate();
  const isCurrentUserAdmin = currentUserRole === "admin";

  // Handle role change
  const handleRoleChange = async (userId: string, newRole: ExperimentMemberRole) => {
    if (newExperiment && onUpdateMemberRole) {
      setUpdatingMemberId(userId);
      await onUpdateMemberRole(userId, newRole);
      setUpdatingMemberId(null);

      return;
    }

    if (!experimentId) return;

    setUpdatingMemberId(userId);
    try {
      await updateMemberRole({
        params: { id: experimentId, memberId: userId },
        body: { role: newRole },
      });

      toast({ description: t("experimentSettings.roleUpdated") });
    } catch (err) {
      toast({ description: parseApiError(err)?.message, variant: "destructive" });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  // Convert members and users to membersWithUserInfo if needed
  const membersWithUserInfo = useMemo(() => {
    if (providedMembersWithUserInfo) return providedMembersWithUserInfo;

    if (!members) return [];

    return members.map((member) => {
      const user = users?.find((u) => u.userId === member.userId) ?? {
        userId: member.userId,
        firstName: "",
        lastName: "",
        email: null,
        bio: null,
        organization: undefined,
      };

      return {
        role: member.role ?? t("experimentSettings.defaultRole", "member"),
        joinedAt: new Date().toISOString(),
        user,
      };
    });
  }, [providedMembersWithUserInfo, members, users, t]);

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
    <div className="max-h-[200px] space-y-3 overflow-y-auto pr-2">
      {membersWithUserInfo.map((member) => {
        const isLastAdmin = member.role === "admin" && adminCount === 1;
        return (
          <div
            key={member.user.userId}
            className="flex items-center justify-between rounded border p-3"
          >
            <div className="flex min-w-0 flex-1 flex-col space-y-1">
              <div className="flex min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2">
                  <h4 className="text-foreground truncate text-sm font-medium md:text-base">
                    {`${member.user.firstName} ${member.user.lastName}`}
                  </h4>
                  <span
                    className="flex min-w-0 items-center gap-x-1"
                    title={member.user.email ?? t("experimentSettings.noEmail")}
                  >
                    <Mail className="text-muted-foreground h-3 w-3 flex-shrink-0" />
                    <span className="text-muted-foreground truncate text-xs md:max-w-[200px] md:text-sm">
                      {member.user.email ?? t("experimentSettings.noEmail")}
                    </span>
                  </span>
                </div>
              </div>

              <div className="text-muted-foreground flex items-center space-x-1 text-[11px] md:text-xs">
                <Calendar className="relative top-[-1.5px] h-3 w-3 flex-shrink-0" />
                <span className="whitespace-nowrap">
                  {t("experimentSettings.joined")} {formatDate(member.joinedAt)}
                </span>
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-col-reverse items-end space-x-3 pl-4 md:flex-row md:items-center">
              <Select
                value={member.role}
                onValueChange={(value) =>
                  handleRoleChange(member.user.userId, value as ExperimentMemberRole)
                }
                disabled={
                  !newExperiment &&
                  (!experimentId ||
                    updatingMemberId === member.user.userId ||
                    isLastAdmin ||
                    !isCurrentUserAdmin)
                }
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t("experimentSettings.roleMember")}</SelectItem>
                  <SelectItem value="admin">{t("experimentSettings.roleAdmin")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveMember(member.user.userId)}
                disabled={
                  !newExperiment &&
                  ((isRemovingMember && removingMemberId === member.user.userId) ||
                    isLastAdmin ||
                    (!isCurrentUserAdmin && member.user.userId !== currentUserId))
                }
                title={
                  isLastAdmin
                    ? t("experimentSettings.cannotRemoveLastAdmin")
                    : t("experimentSettings.removeMember")
                }
                className="hover:bg-destructive/10 h-8 w-8 p-0"
              >
                <Trash2 className="text-destructive h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
