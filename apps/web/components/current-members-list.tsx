import { formatDate } from "@/util/date";
import { Trash2, Mail, Calendar } from "lucide-react";
import { useMemo } from "react";

import type { User } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Badge } from "@repo/ui/components";

interface MemberWithUserInfo {
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface Member {
  userId: string;
  role?: "admin" | "member";
}

interface MemberListProps {
  // Accept either ready-made formatted membersWithUserInfo or raw members with users
  members?: Member[];
  users?: User[];
  membersWithUserInfo?: MemberWithUserInfo[];
  onRemoveMember: (memberId: string) => void;
  isRemovingMember: boolean;
  removingMemberId: string | null;
  adminCount?: number;
}

export function MemberList({
  members,
  users,
  membersWithUserInfo: providedMembersWithUserInfo,
  onRemoveMember,
  isRemovingMember,
  removingMemberId,
  adminCount = 0,
}: MemberListProps) {
  const { t } = useTranslation();

  // Convert members and users to membersWithUserInfo if needed
  const membersWithUserInfo = useMemo(() => {
    if (providedMembersWithUserInfo) return providedMembersWithUserInfo;

    if (!members) return [];

    return members.map((member) => {
      const user = users?.find((u) => u.id === member.userId) ?? {
        id: member.userId,
        name: null,
        email: null,
        emailVerified: null,
        image: null,
        createdAt: "",
      };

      return {
        role: member.role ?? t("experimentSettings.defaultRole", "member"),
        joinedAt: new Date().toISOString(),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
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
            key={member.user.id}
            className="flex items-center justify-between rounded border p-3"
          >
            <div className="flex min-w-0 flex-1 flex-col space-y-1">
              <div className="flex min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2">
                  <h4 className="text-foreground truncate text-sm font-medium md:text-base">
                    {member.user.name ?? t("experimentSettings.unknownUser")}
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

            <div className="flex flex-shrink-0 items-center space-x-3 pl-4">
              <Badge variant="default" className="whitespace-nowrap">
                {member.role}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveMember(member.user.id)}
                disabled={(isRemovingMember && removingMemberId === member.user.id) || isLastAdmin}
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
