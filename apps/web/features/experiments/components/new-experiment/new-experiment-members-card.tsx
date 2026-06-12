"use client";

import { countAdmins } from "@/features/experiments/domain/access";
import { useUserSearch } from "@/features/experiments/hooks/useUserSearch";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useMemo, useState } from "react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type {
  CreateExperimentBody,
  ExperimentMemberRole,
} from "@repo/api/schemas/experiment.schema";
import type { UserProfile } from "@repo/api/schemas/user.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/card";

import { MemberList } from "../current-members-list/current-members-list";
import { UserSearchPopover } from "../user-search-popover";

interface NewExperimentMembersCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentMembersCard({ form }: NewExperimentMembersCardProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? "";

  // Use useFieldArray to manage the members array
  const {
    fields: members,
    append,
    remove,
    update,
  } = useFieldArray({
    control: form.control,
    name: "members",
  });

  // Member management state
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<ExperimentMemberRole>("member");
  const [debouncedSearch, isDebounced] = useDebounce(userSearch, 300);
  const { data: userSearchData, isLoading: isFetchingUsers } = useUserSearch(debouncedSearch);

  // Filter available users (exclude already added and current user)
  const availableProfiles = useMemo(
    () =>
      userSearchData?.body.filter(
        (profile: UserProfile) =>
          !members.some((m) => m.userId === profile.userId) && profile.userId !== currentUserId,
      ) ?? [],
    [userSearchData, members, currentUserId],
  );

  // Add member handler
  const handleAddMember = () => {
    if (!selectedUser) return;

    append({
      userId: selectedUser.userId,
      role: selectedRole,
      firstName: selectedUser.firstName,
      lastName: selectedUser.lastName,
      email: selectedUser.email,
      avatarUrl: selectedUser.avatarUrl,
    });
    setSelectedUser(null);
    setUserSearch("");
    setSelectedRole("member");
  };

  // Remove member handler
  const handleRemoveMember = (userId: string) => {
    const index = members.findIndex((m) => m.userId === userId);
    if (index !== -1) {
      remove(index);
    }
  };

  // Update member role
  const handleUpdateMemberRole = (userId: string, role: ExperimentMemberRole) => {
    const index = members.findIndex((m) => m.userId === userId);
    if (index !== -1) {
      update(index, { ...members[index], role });
    }
  };

  const adminCount = useMemo(() => countAdmins(members), [members]);

  const membersWithUserInfo = useMemo(
    () =>
      members.map((member) => ({
        role: member.role ?? "member",
        joinedAt: "",
        user: {
          userId: member.userId,
          firstName: member.firstName ?? "",
          lastName: member.lastName ?? "",
          email: member.email ?? null,
          bio: null,
          activated: null,
          organization: undefined,
          avatarUrl: member.avatarUrl ?? null,
        },
      })),
    [members],
  );

  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <CardTitle>{t("newExperiment.addMembersTitle")}</CardTitle>
        <CardDescription>{t("newExperiment.addMembersDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add member section */}
        <div className="flex gap-2">
          <UserSearchPopover
            availableUsers={availableProfiles}
            searchValue={userSearch}
            onSearchChange={setUserSearch}
            isAddingUser={false}
            loading={!isDebounced || isFetchingUsers}
            onSelectUser={setSelectedUser}
            placeholder={t("experiments.searchUsersPlaceholder")}
            selectedUser={selectedUser}
            onClearSelection={() => setSelectedUser(null)}
            selectedRole={selectedRole}
            onRoleChange={(val) => setSelectedRole(val as ExperimentMemberRole)}
          />
          <Button onClick={handleAddMember} variant="muted" disabled={!selectedUser} size="default">
            {t("common.add")}
          </Button>
        </div>

        {/* Current members section */}
        <MemberList
          membersWithUserInfo={membersWithUserInfo}
          onRemoveMember={handleRemoveMember}
          isRemovingMember={false}
          removingMemberId={null}
          adminCount={adminCount}
          newExperiment={true}
          onUpdateMemberRole={handleUpdateMemberRole}
        />
      </CardContent>
    </Card>
  );
}
