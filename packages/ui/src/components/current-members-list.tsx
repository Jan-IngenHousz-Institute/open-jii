import { Trash2 } from "lucide-react";
import { Button, Badge } from "@repo/ui/components";

interface MemberWithUserInfo {
    userId: string;
    role: string;
    joinedAt: string;
    user: {
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
            <p className="text-muted-foreground text-sm">
                No members added yet
            </p>
        );
    }

    return (
        <div className="max-h-[200px] space-y-3 overflow-y-auto pr-2">
            {membersWithUserInfo.map((member) => {
                const isLastAdmin = member.role === "admin" && adminCount === 1;
                return (
                    <div
                        key={member.userId}
                        className="flex items-center justify-between rounded-md border p-3"
                    >
                        <div className="flex flex-col">
                            <span>
                                {member.user.name ?? "Unknown User"}{" "}
                                <span className="text-muted-foreground text-xs">
                                    {member.user.email ?? "No email"}
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
                                onClick={() => onRemoveMember(member.userId)}
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
    );
}