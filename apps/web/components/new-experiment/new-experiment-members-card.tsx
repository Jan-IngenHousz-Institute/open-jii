"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useUserSearch } from "@/hooks/useUserSearch";
import { useMemo, useState } from "react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type { UserProfile, CreateExperimentBody, ExperimentMemberRole } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

import { MemberList } from "../current-members-list/current-members-list";
import { UserSearchPopover } from "../user-search-popover";

interface Member {
  userId: string;
  role?: ExperimentMemberRole;
  firstName?: string;
  lastName?: string;
  email?: string | null;
}

interface NewExperimentMembersCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentMembersCard({ form }: NewExperimentMembersCardProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? "";

  // Use useFieldArray to manage the members array
  const {
    fields: memberFields,
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

  const members: Member[] = useMemo(() => memberFields as Member[], [memberFields]);

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

  // Calculate admin count
  const adminCount = useMemo(() => {
    return members.filter((m) => m.role === "admin").length;
  }, [members]);

  // Build combined profiles from members for display
  const combinedProfiles = useMemo(() => {
    const allProfiles: UserProfile[] = [];

    // Add profiles from members that have user data
    members.forEach((member) => {
      if (member.firstName || member.lastName || member.email) {
        allProfiles.push({
          userId: member.userId,
          firstName: member.firstName ?? "",
          lastName: member.lastName ?? "",
          email: member.email ?? null,
          bio: null,
          activated: null,
          organization: undefined,
        });
      }
    });

    // Add any profiles from search results that aren't already in the list
    if (userSearchData?.body) {
      userSearchData.body.forEach((profile: UserProfile) => {
        if (!allProfiles.some((p) => p.userId === profile.userId)) {
          allProfiles.push(profile);
        }
      });
    }

    return allProfiles;
  }, [members, userSearchData]);

  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <CardTitle>{t("newExperiment.addMembersTitle")}</CardTitle>
        <CardDescription>{t("newExperiment.addMembersDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <UserSearchPopover
            availableUsers={availableProfiles}
            searchValue={userSearch}
            onSearchChange={setUserSearch}
            isAddingUser={false}
            loading={!isDebounced || isFetchingUsers}
            onSelectUser={setSelectedUser}
            placeholder={t("newExperiment.addMemberPlaceholder")}
            selectedUser={selectedUser}
            onClearSelection={() => setSelectedUser(null)}
          />
          <Select
            value={selectedRole}
            onValueChange={(val) => setSelectedRole(val as ExperimentMemberRole)}
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
            onClick={handleAddMember}
            disabled={!selectedUser}
            size="default"
            className="flex-1 md:flex-none"
          >
            {t("common.add")}
          </Button>
        </div>
        <MemberList
          members={members}
          users={combinedProfiles}
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
