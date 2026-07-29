"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useUserSearch } from "@/hooks/useUserSearch";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type { CreateExperimentBody } from "@repo/api/domains/experiment/experiment.schema";
import type { UserProfile } from "@repo/api/domains/user/user.schema";
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

import { UserAvatar } from "../user-avatar";
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
  } = useFieldArray({
    control: form.control,
    name: "members",
  });

  // Member management state
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [debouncedSearch, isDebounced] = useDebounce(userSearch, 300);
  const { data: userSearchData, isLoading: isFetchingUsers } = useUserSearch(debouncedSearch);

  // Filter available users (exclude already added and current user)
  const availableProfiles = useMemo(
    () =>
      userSearchData?.filter(
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
      firstName: selectedUser.firstName,
      lastName: selectedUser.lastName,
      email: selectedUser.email,
      avatarUrl: selectedUser.avatarUrl,
    });
    setSelectedUser(null);
    setUserSearch("");
  };

  // Remove member handler
  const handleRemoveMember = (userId: string) => {
    const index = members.findIndex((m) => m.userId === userId);
    if (index !== -1) {
      remove(index);
    }
  };

  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <CardTitle>{t("newExperiment.addCollaboratorsTitle")}</CardTitle>
        <CardDescription>{t("newExperiment.addCollaboratorsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Everyone picked here starts on the contributing tier; raising someone to
            "Can edit" happens on the experiment's own collaborators surface. */}
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
          />
          <Button onClick={handleAddMember} variant="muted" disabled={!selectedUser} size="default">
            {t("common.add")}
          </Button>
        </div>

        <p className="text-muted-foreground text-xs leading-relaxed">
          {t("newExperiment.initialCollaboratorsTierNote")}
        </p>

        {/* Picked collaborators, removable until the experiment is created */}
        {members.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("sharing.noCollaboratorsYet")}</p>
        ) : (
          <ul className="divide-border divide-y">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center gap-3 py-2">
                <UserAvatar
                  avatarUrl={member.avatarUrl ?? null}
                  firstName={member.firstName ?? ""}
                  lastName={member.lastName ?? ""}
                  className="h-8 w-8 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {`${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()}
                  </p>
                  {member.email && (
                    <p className="text-muted-foreground truncate text-xs">{member.email}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.remove")}
                  onClick={() => handleRemoveMember(member.userId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
