"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { Mail, User } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import type { NewOrganizationFormValues } from "../form-step";
import { pendingPersonRoleText } from "../form-step";

interface PeopleSectionProps {
  formData: NewOrganizationFormValues;
  onEdit: () => void;
  className?: string;
}

export function PeopleSection({ formData, onEdit, className }: PeopleSectionProps) {
  const { t } = useTranslation();

  const people = formData.people;

  return (
    <SettingsCard
      title={t("organizations.create.peopleTitle")}
      action={
        <Button type="button" onClick={onEdit} variant="link" size="sm">
          {t("common.edit")}
        </Button>
      }
      className={className}
      contentClassName="space-y-3"
    >
      {people.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("organizations.create.people.empty")}</p>
      ) : (
        <>
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            {t("organizations.create.people.count", { count: people.length })}
          </div>
          <ul className="space-y-2">
            {people.map((person) => (
              <li
                key={person.kind === "user" ? person.userId : person.email}
                className="flex items-center gap-2 text-sm"
              >
                {person.kind === "user" ? (
                  <User className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : (
                  <Mail className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                {/* `truncate` does nothing on a flex child without `min-w-0`. */}
                <span className="min-w-0 truncate font-medium">
                  {person.kind === "user" ? person.displayName : person.email}
                </span>
                {/* The role is the half of this a reviewer cannot infer from the name. */}
                <span className="text-muted-foreground min-w-0 truncate text-xs">
                  {pendingPersonRoleText(person, t)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-muted-foreground text-xs leading-relaxed">
        {t("organizations.create.people.teamsNote")}
      </p>
    </SettingsCard>
  );
}
