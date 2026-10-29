"use client";

import { PersonIdentity } from "@/components/people/person-identity";
import { Mail } from "lucide-react";

import { useTranslation } from "@repo/i18n";

import type { PendingOrganizationPerson } from "./steps/form-step";

/** The left half of a collected person's row; each list adds its own right side. */
export function PendingPersonIdentity({ person }: { person: PendingOrganizationPerson }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
      {person.kind === "user" ? (
        <PersonIdentity person={person.person} size="sm" />
      ) : (
        <>
          <span className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full border">
            <Mail className="text-muted-foreground h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{person.email}</p>
            {/* How they arrive, in words: the icon that says it is aria-hidden. */}
            <p className="text-muted-foreground truncate text-xs">
              {t("organizations.create.people.invitedByEmail")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
