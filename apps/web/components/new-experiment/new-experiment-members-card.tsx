"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { X } from "lucide-react";
import { useState } from "react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type { CreateExperimentBody } from "@repo/api/domains/experiment/experiment.schema";
import type { UserProfile, UserSearchResult } from "@repo/api/domains/user/user.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { PersonIdentity } from "../people/person-identity";
import { personName } from "../people/person-name";
import { PeoplePicker } from "../people/picking/people-picker";
import { describeSearchedUser, usePickerRows } from "../people/picking/picking-rule";
import { usePeopleSearch } from "../people/picking/use-people-search";

export function describeNewExperimentCandidate(
  user: UserSearchResult,
  {
    addedUserIds,
    typedEmail,
    t,
  }: { addedUserIds: readonly string[]; typedEmail: string | null; t: (key: string) => string },
) {
  const reason = addedUserIds.includes(user.userId) ? t("newExperiment.alreadyAdded") : null;
  return describeSearchedUser(user, { typedEmail, t, reason });
}

interface NewExperimentMembersCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentMembersCard({ form }: NewExperimentMembersCardProps) {
  const { t } = useTranslation();

  // Use useFieldArray to manage the members array
  const {
    fields: members,
    append,
    remove,
  } = useFieldArray({
    control: form.control,
    name: "members",
  });

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const search = usePeopleSearch({ kind: "global" });
  const rows = usePickerRows(search.people, (user) =>
    describeNewExperimentCandidate(user, {
      addedUserIds: members.map((member) => member.userId),
      typedEmail: search.typedEmail,
      t,
    }),
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
  };

  // Remove member handler
  const handleRemoveMember = (userId: string) => {
    const index = members.findIndex((m) => m.userId === userId);
    if (index !== -1) {
      remove(index);
    }
  };

  return (
    <SettingsCard
      title={t("newExperiment.addCollaboratorsTitle")}
      description={t("newExperiment.addCollaboratorsDescription")}
      contentClassName="space-y-6"
      // A grid item sizes to its content's widest line unless allowed to shrink.
      className="min-w-0"
    >
      {/* Everyone picked here starts on the contributing tier; raising someone to
            "Can edit" happens on the experiment's own collaborators surface. */}
      <div className="flex gap-2">
        <PeoplePicker
          className="min-w-0 flex-1"
          term={search.term}
          onTermChange={search.setTerm}
          selectionLabel={selectedUser ? personName(selectedUser, t) : null}
          onClear={() => setSelectedUser(null)}
          placeholder={t("experiments.searchUsersPlaceholder")}
          ariaLabel={t("experiments.searchUsers")}
          status={search.status}
          rows={rows}
          onPick={setSelectedUser}
          emptyMessage={t("experiments.noUsersFound", { search: search.term.trim() })}
        />
        <Button
          onClick={handleAddMember}
          variant="secondary"
          disabled={!selectedUser}
          size="default"
        >
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
              <PersonIdentity person={{ ...member, id: member.userId }} size="sm" />
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
    </SettingsCard>
  );
}
