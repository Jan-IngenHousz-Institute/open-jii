import { Trash2, Mail, Calendar } from "lucide-react";

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

interface MemberListProps {
  membersWithUserInfo: MemberWithUserInfo[];
  formatDate: (date: string) => string;
  onRemoveMember: (memberId: string) => void;
  isRemovingMember: boolean;
  removingMemberId: string | null;
  adminCount: number;
}

export function MemberList({
  membersWithUserInfo,
  formatDate,
  onRemoveMember,
  isRemovingMember,
  removingMemberId,
  adminCount,
}: MemberListProps) {
  if (membersWithUserInfo.length === 0) {
    return (
      <div className="border-muted flex flex-col items-center justify-center py-4">
        <p className="text-muted-foreground text-base font-medium">
          No members added yet
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Add collaborators to your experiment
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
                    {member.user.name ?? "Unknown User"}
                  </h4>
                  <span
                    className="flex min-w-0 items-center gap-x-1"
                    title={member.user.email ?? "No email"}
                  >
                    <Mail className="text-muted-foreground h-3 w-3 flex-shrink-0" />
                    <span className="text-muted-foreground truncate text-xs md:max-w-[200px] md:text-sm">
                      {member.user.email ?? "No email"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="text-muted-foreground flex items-center space-x-1 text-[11px] md:text-xs">
                <Calendar className="relative top-[-1.5px] h-3 w-3 flex-shrink-0" />
                <span className="whitespace-nowrap">
                  Joined {formatDate(member.joinedAt)}
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
                disabled={
                  (isRemovingMember && removingMemberId === member.user.id) ||
                  isLastAdmin
                }
                title={
                  isLastAdmin ? "Cannot remove the last admin" : "Remove member"
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
