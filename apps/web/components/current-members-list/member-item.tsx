import { Mail } from "lucide-react";

import type { UserProfile } from "@repo/api/schemas/user.schema";
import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { UserAvatar } from "../user-avatar";

interface MemberItemProps {
  member: {
    role: string;
    joinedAt: string;
    user: Partial<UserProfile> & {
      userId: string;
      firstName: string;
      lastName: string;
      avatarUrl?: string | null;
    };
  };
  isLastAdmin: boolean;
  currentUserId?: string;
  isCurrentUserAdmin: boolean;
  updatingMemberId: string | null;
  experimentId?: string;
  newExperiment: boolean;
  isRemovingMember: boolean;
  removingMemberId: string | null;
  onValueChange: (value: string) => void;
  isArchived?: boolean;
}

export function MemberItem({
  member,
  isLastAdmin,
  currentUserId,
  isCurrentUserAdmin,
  updatingMemberId,
  experimentId,
  newExperiment,
  isRemovingMember,
  removingMemberId,
  onValueChange,
  isArchived = false,
}: MemberItemProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <UserAvatar
        avatarUrl={member.user.avatarUrl}
        firstName={member.user.firstName}
        lastName={member.user.lastName}
        className="h-9 w-9"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <h4
          className="text-foreground truncate text-sm font-medium"
          title={`${member.user.firstName} ${member.user.lastName}`}
        >
          {`${member.user.firstName} ${member.user.lastName}`}
        </h4>
        <span className="flex min-w-0 items-center gap-x-1">
          <Mail className="text-muted-foreground h-3 w-3 flex-shrink-0" />
          <span
            className="text-muted-foreground truncate text-xs"
            title={member.user.email ?? t("experimentSettings.noEmail")}
          >
            {member.user.email ?? t("experimentSettings.noEmail")}
          </span>
        </span>
      </div>

      <div className="flex flex-shrink-0">
        <Select
          value={member.role}
          disabled={
            isArchived ||
            updatingMemberId === member.user.userId ||
            (!newExperiment && !isCurrentUserAdmin && member.user.userId !== currentUserId)
          }
          onValueChange={onValueChange}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              disabled={
                !newExperiment &&
                (!experimentId ||
                  updatingMemberId === member.user.userId ||
                  (isLastAdmin && member.user.userId !== currentUserId) ||
                  !isCurrentUserAdmin)
              }
              value="member"
            >
              {t("experimentSettings.roleMember")}
            </SelectItem>
            <SelectItem
              disabled={
                !newExperiment &&
                (!experimentId ||
                  updatingMemberId === member.user.userId ||
                  (isLastAdmin && member.user.userId !== currentUserId) ||
                  !isCurrentUserAdmin)
              }
              value="admin"
            >
              {t("experimentSettings.roleAdmin")}
            </SelectItem>
            <div className="my-1 border-t" />
            <SelectItem
              value={member.user.userId === currentUserId ? "leave" : "remove"}
              disabled={
                !newExperiment &&
                member.user.userId !== currentUserId &&
                ((isRemovingMember && removingMemberId === member.user.userId) ||
                  isLastAdmin ||
                  !isCurrentUserAdmin)
              }
              className="text-destructive focus:text-destructive"
            >
              {member.user.userId === currentUserId
                ? t("experimentSettings.leave")
                : t("experimentSettings.remove")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
