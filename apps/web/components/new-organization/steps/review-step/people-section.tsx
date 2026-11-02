"use client";

import { SettingsCard } from "@/components/shared/settings-card";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";

import { organizationRoleLabelKey } from "../../../organizations/organization-labels";
import { PendingPersonIdentity } from "../../pending-person-identity";
import type { NewOrganizationFormValues } from "../form-step";

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
          <ul className="divide-border divide-y rounded-md border">
            {people.map((person) => (
              <li
                key={person.kind === "user" ? person.userId : person.email}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5"
              >
                <PendingPersonIdentity person={person} />
                <Badge variant="secondary" className="ml-auto shrink-0 text-xs font-normal">
                  {t(organizationRoleLabelKey(person.role))}
                </Badge>
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
