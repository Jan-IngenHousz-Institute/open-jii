import { formatDate } from "@/util/date";
import type { UseFormReturn } from "react-hook-form";

import type { User, CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components";

import { MemberList } from "./current-members-list";
import { UserSearchWithDropdown } from "./user-search-with-dropdown";

interface NewExperimentMembersCardProps {
  form: UseFormReturn<CreateExperimentBody>;
  availableUsers: User[];
  selectedUserId: string;
  setSelectedUserId: (id: string) => void;
  userSearch: string;
  setUserSearch: (v: string) => void;
  isDebounced: boolean;
  isFetchingUsers: boolean;
  handleAddMember: (userId: string) => Promise<void>;
  members: { userId: string; role?: string }[];
  getUserInfo: (member: { userId: string }) => User;
  handleRemoveMember: (userId: string) => void;
  adminCount: number;
}

export function NewExperimentMembersCard({
  availableUsers,
  selectedUserId,
  setSelectedUserId,
  userSearch,
  setUserSearch,
  isDebounced,
  isFetchingUsers,
  handleAddMember,
  members,
  getUserInfo,
  handleRemoveMember,
  adminCount,
}: NewExperimentMembersCardProps) {
  const { t } = useTranslation(undefined, "common");
  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <CardTitle>{t("newExperiment.addMembersTitle")}</CardTitle>
        <CardDescription>
          {t("newExperiment.addMembersDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mb-2">
          <UserSearchWithDropdown
            availableUsers={availableUsers}
            value={selectedUserId}
            onValueChange={setSelectedUserId}
            placeholder={t("newExperiment.addMemberPlaceholder")}
            loading={!isDebounced || isFetchingUsers}
            searchValue={userSearch}
            onSearchChange={setUserSearch}
            onAddUser={handleAddMember}
            isAddingUser={false}
          />
        </div>
        <MemberList
          membersWithUserInfo={members.map((member) => ({
            ...member,
            role: member.role ?? "member",
            joinedAt: new Date().toISOString(),
            user: getUserInfo(member),
          }))}
          formatDate={formatDate}
          onRemoveMember={handleRemoveMember}
          isRemovingMember={false}
          removingMemberId={null}
          adminCount={adminCount}
        />
      </CardContent>
    </Card>
  );
}
