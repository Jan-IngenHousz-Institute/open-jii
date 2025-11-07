"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useUserSearch } from "@/hooks/useUserSearch";
import { useEffect, useMemo, useState } from "react";
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

  // Member management state
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<ExperimentMemberRole>("member");
  const [debouncedSearch, isDebounced] = useDebounce(userSearch, 300);
  const { data: userSearchData, isLoading: isFetchingUsers } = useUserSearch(debouncedSearch);
  // Track added users for display - we collect users as we add them
  const [addedProfiles, setAddedProfiles] = useState<UserProfile[]>([]);

  // Use form for members instead of useState
  const watchedMembers = form.watch("members");
  const members: Member[] = useMemo(() => watchedMembers ?? [], [watchedMembers]);

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

    form.setValue("members", [
      ...members,
      {
        userId: selectedUser.userId,
        role: selectedRole,
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        email: selectedUser.email,
      },
    ]);
    setAddedProfiles((prev) =>
      prev.some((p) => p.userId === selectedUser.userId) ? prev : [...prev, selectedUser],
    );
    setSelectedUser(null);
    setUserSearch("");
    setSelectedRole("member");
  };

  // Remove member handler
  const handleRemoveMember = (userId: string) => {
    form.setValue(
      "members",
      members.filter((m) => m.userId !== userId),
    );
  };

  const handleUpdateMemberRole = (userId: string, role: ExperimentMemberRole) => {
    form.setValue(
      "members",
      members.map((m) => (m.userId === userId ? { ...m, role } : m)),
    );
  };

  // Calculate admin count
  const adminCount = useMemo(() => {
    return members.filter((m) => m.role === "admin").length;
  }, [members]);

  // Combine added users with users from search results to pass to MemberList
  const combinedProfiles = useMemo(() => {
    // Start with profiles we've added
    const allProfiles = [...addedProfiles];

    // Add any profiles from search results that aren't already in the list
    if (userSearchData?.body) {
      userSearchData.body.forEach((profile: UserProfile) => {
        if (!allProfiles.some((p) => p.userId === profile.userId)) {
          allProfiles.push(profile);
        }
      });
    }

    return allProfiles;
  }, [addedProfiles, userSearchData]);

  useEffect(() => {
    const hydratedProfiles = members
      .filter((m) => m.firstName ?? m.lastName ?? m.email)
      .map((m) => ({
        userId: m.userId,
        firstName: m.firstName ?? "",
        lastName: m.lastName ?? "",
        email: m.email ?? null,
        bio: null,
        activated: null,
        organization: undefined,
      }));

    setAddedProfiles(hydratedProfiles);
  }, [members]);

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
            Add
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
