import { useDebounce } from "@/hooks/useDebounce";
import { useUserSearch } from "@/hooks/useUserSearch";
import { formatDate } from "@/util/date";
import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { User, CreateExperimentBody } from "@repo/api";
import { useSession } from "@repo/auth/client";
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

interface Member {
  userId: string;
  role?: "admin" | "member";
}

interface NewExperimentMembersCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentMembersCard({
  form,
}: NewExperimentMembersCardProps) {
  const { t } = useTranslation(undefined, "common");
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? "";

  // Member management state
  const [userSearch, setUserSearch] = useState("");
  const [debouncedSearch, isDebounced] = useDebounce(userSearch, 300);
  const { data: userSearchData, isLoading: isFetchingUsers } =
    useUserSearch(debouncedSearch);
  const [selectedUserId, setSelectedUserId] = useState("");
  // Track added users for display
  const [addedUsers, setAddedUsers] = useState<User[]>([]);

  // Use form for members instead of useState
  const watchedMembers = form.watch("members");
  const members: Member[] = useMemo(
    () => (watchedMembers ?? []) as Member[],
    [watchedMembers],
  );
  // Filter available users (exclude already added and current user)
  const availableUsers = useMemo(
    () =>
      userSearchData?.body.filter(
        (user: User) =>
          !members.some((m) => m.userId === user.id) &&
          user.id !== currentUserId,
      ) ?? [],
    [userSearchData, members, currentUserId],
  );

  const adminCount = useMemo(() => {
    return members.filter((m) => m.role === "admin").length;
  }, [members]);

  // Add member handler
  const handleAddMember = (userId: string): Promise<void> => {
    const user = availableUsers.find((u) => u.id === userId);
    if (!user) return Promise.resolve();
    form.setValue("members", [...members, { userId: user.id, role: "member" }]);
    setAddedUsers((prev) =>
      prev.some((u) => u.id === user.id) ? prev : [...prev, user],
    );
    setSelectedUserId("");
    setUserSearch("");
    return Promise.resolve();
  };

  // Remove member handler
  const handleRemoveMember = (userId: string) => {
    form.setValue(
      "members",
      members.filter((m) => m.userId !== userId),
    );
  };

  // Helper to get user info from addedUsers, then userSearchData, then fallback
  const getUserInfo = (member: { userId: string }): User => {
    const found = addedUsers.find((u) => u.id === member.userId);
    if (found) return found;
    const foundSearch = userSearchData?.body.find(
      (u: User) => u.id === member.userId,
    );
    if (foundSearch) return foundSearch;
    return {
      id: member.userId,
      name: "Loading user info...",
      email: "",
      emailVerified: null,
      image: null,
      createdAt: "",
    };
  };

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
