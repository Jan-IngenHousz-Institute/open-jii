"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useUserSearch } from "@/hooks/useUserSearch";
import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { UserProfile, CreateExperimentBody } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components";

import { MemberList } from "../current-members-list/current-members-list";
import { UserSearchWithDropdown } from "../user-search-with-dropdown";

interface Member {
  userId: string;
  role?: "admin" | "member";
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
  const [debouncedSearch, isDebounced] = useDebounce(userSearch, 300);
  const { data: userSearchData, isLoading: isFetchingUsers } = useUserSearch(debouncedSearch);
  const [selectedUserId, setSelectedUserId] = useState("");
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
  const handleAddMember = (profileId: string) => {
    const profile = availableProfiles.find((p) => p.userId === profileId);
    if (!profile) return;
    form.setValue("members", [...members, { userId: profile.userId, role: "member" }]);
    setAddedProfiles((prev) =>
      prev.some((p) => p.userId === profile.userId) ? prev : [...prev, profile],
    );
    setSelectedUserId("");
    setUserSearch("");
  };

  // Remove member handler
  const handleRemoveMember = (userId: string) => {
    form.setValue(
      "members",
      members.filter((m) => m.userId !== userId),
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

  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <CardTitle>{t("newExperiment.addMembersTitle")}</CardTitle>
        <CardDescription>{t("newExperiment.addMembersDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mb-2">
          <UserSearchWithDropdown
            availableUsers={availableProfiles}
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
          members={members}
          users={combinedProfiles}
          onRemoveMember={handleRemoveMember}
          isRemovingMember={false}
          removingMemberId={null}
          adminCount={adminCount}
        />
      </CardContent>
    </Card>
  );
}
