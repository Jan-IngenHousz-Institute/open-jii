"use client";

import { Mail, User } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";

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
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">
          {t("organizations.create.peopleTitle")}
        </CardTitle>
        <Button type="button" onClick={onEdit} variant="link" size="sm">
          {t("common.edit")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
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
                  <span className="truncate font-medium">
                    {person.kind === "user" ? person.displayName : person.email}
                  </span>
                  {/* The role is the half of this a reviewer cannot infer from the name. */}
                  <span className="text-muted-foreground truncate text-xs">
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
      </CardContent>
    </Card>
  );
}
