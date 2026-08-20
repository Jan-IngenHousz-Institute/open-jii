"use client";

import { Mail, Network, User, X } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { OrganizationRole } from "@repo/api/domains/organization/organization.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { organizationRoleLabelKey } from "../organizations/organization-labels";
import type { OrganizationInviteSelection } from "../organizations/organization-member-picker";
import { OrganizationMemberPicker } from "../organizations/organization-member-picker";
import { invitableRoles } from "../organizations/organization-roster-rules";
import type { NewOrganizationFormValues, PendingOrganizationPerson } from "./steps/form-step";

interface NewOrganizationPeopleCardProps {
  form: UseFormReturn<NewOrganizationFormValues>;
}

/**
 * Who the organization starts with, collected rather than applied: nothing here is a
 * membership or an invitation until the organization exists, so the picker's selections
 * are held on the form and spent on submit.
 *
 * The picker is the organization's own, unchanged — it never wrote anything itself, it
 * reports a selection. Its exclusion lists carry the people already collected here plus
 * whoever is creating the organization, so nobody can be collected twice and nobody can
 * be invited to an organization they already own.
 *
 * Three regions, each owning the text about it: the composer for adding somebody, the
 * list of who has been collected, and the aside about teams. Prose that belongs to a
 * control sits with that control — a sentence floating between two regions belongs to
 * neither, and reads as leftover rather than as guidance.
 */
export function NewOrganizationPeopleCard({ form }: NewOrganizationPeopleCardProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();

  const people = form.watch("people");
  const [selection, setSelection] = useState<OrganizationInviteSelection | null>(null);
  const [role, setRole] = useState<OrganizationRole>("member");

  // Whoever is creating the organization is its owner, so every role is theirs to hand
  // out. Asked of the roster's own rule rather than assumed, so this and the invitation
  // dialog cannot drift apart on who may make an owner.
  const roles = invitableRoles("owner");

  const setPeople = (next: PendingOrganizationPerson[]) =>
    form.setValue("people", next, { shouldDirty: true });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("organizations.create.peopleTitle")}</CardTitle>
        <CardDescription>{t("organizations.create.peopleDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Somebody, then the role they arrive on, then Add — the order the invitation
            dialog asks in, in one inset panel so it reads as a single act rather than
            three stacked controls. Muted and unshadowed on purpose: a nested Card here
            would look like a card inside a card. */}
        <section className="bg-muted/40 space-y-4 rounded-md border p-4">
          <h3 className="text-sm font-semibold">{t("organizations.create.people.addTitle")}</h3>

          <OrganizationMemberPicker
            selection={selection}
            onSelectionChange={setSelection}
            // Whoever is creating the organization is excluded alongside the people
            // already collected: they are its owner the moment it exists, so offering
            // them would send an invitation to their own organization.
            memberUserIds={[
              ...people.flatMap((person) => (person.kind === "user" ? [person.userId] : [])),
              ...(session ? [session.user.id] : []),
            ]}
            memberEmails={[]}
            pendingInvitationEmails={people.flatMap((person) =>
              person.kind === "email" ? [person.email] : [],
            )}
            excludedLabel={t("organizations.create.people.alreadyAdded")}
          />

          <div className="space-y-1.5">
            <Label htmlFor="new-organization-role">{t("organizations.invite.roleLabel")}</Label>
            <Select value={role} onValueChange={(next) => setRole(next as OrganizationRole)}>
              <SelectTrigger id="new-organization-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((invitable) => (
                  <SelectItem key={invitable} value={invitable}>
                    {t(organizationRoleLabelKey(invitable))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Attached to the select and changing with it: what this role can actually
                do, which is the question somebody choosing between three has. */}
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t(`organizations.roleHints.${role}`)}
            </p>
          </div>

          <Button
            type="button"
            variant="muted"
            className="w-full sm:w-auto"
            disabled={selection === null}
            onClick={() => {
              if (selection === null) return;
              setPeople([...people, { ...selection, role }]);
              setSelection(null);
              // Back to the least privileged role: the next person is a separate
              // decision, and inheriting "owner" from the last one is nobody's decision.
              setRole("member");
            }}
          >
            {t("common.add")}
          </Button>
        </section>

        {/* A labelled region rather than a bare list, so the empty state reads as "this
            list is empty" instead of as a stray sentence between two controls. */}
        <section className="space-y-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold">{t("organizations.create.people.listTitle")}</h3>
            {people.length > 0 ? (
              <span className="text-muted-foreground text-xs">
                {t("organizations.create.people.count", { count: people.length })}
              </span>
            ) : null}
          </div>

          {people.length === 0 ? (
            <p className="text-muted-foreground bg-muted/40 rounded-md border px-4 py-5 text-center text-sm">
              {t("organizations.create.people.empty")}
            </p>
          ) : (
            <ul className="divide-border divide-y rounded-md border">
              {people.map((person, index) => {
                const label = person.kind === "user" ? person.displayName : person.email;

                return (
                  <li
                    key={person.kind === "user" ? person.userId : person.email}
                    // Wrapping rather than squeezing: below roughly a phone's width the
                    // role select and the remove button drop to their own line instead of
                    // truncating the name to nothing.
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5"
                  >
                    <span className="bg-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-full border">
                      {person.kind === "user" ? (
                        <User className="text-muted-foreground h-4 w-4" aria-hidden />
                      ) : (
                        <Mail className="text-muted-foreground h-4 w-4" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate text-sm font-medium">{label}</p>
                      {/* How they arrive, in words: the icon that says it is aria-hidden,
                          so on its own it says nothing to anybody listening. */}
                      {person.kind === "email" ? (
                        <p className="text-muted-foreground truncate text-xs">
                          {t("organizations.create.people.invitedByEmail")}
                        </p>
                      ) : null}
                    </div>
                    {/* The roster's own control, doing the roster's job: a mistyped role is
                        fixed where it is read rather than by removing the person and
                        picking them again. */}
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <Select
                        value={person.role}
                        onValueChange={(next) =>
                          setPeople(
                            people.map((collected, position) =>
                              position === index
                                ? { ...collected, role: next as OrganizationRole }
                                : collected,
                            ),
                          )
                        }
                      >
                        <SelectTrigger
                          className="w-[130px]"
                          aria-label={t("organizations.members.roleForLabel", { name: label })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((assignable) => (
                            <SelectItem key={assignable} value={assignable}>
                              {t(organizationRoleLabelKey(assignable))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("common.remove")}
                        onClick={() =>
                          setPeople(people.filter((_, position) => position !== index))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Genuinely an aside, and given the shape of one: this is the step where somebody
            looks for the team they were going to make, and the answer is that a team is a
            group of members, so it cannot come first. */}
        <aside className="text-muted-foreground bg-muted/40 flex items-start gap-2.5 rounded-md border p-3 text-xs leading-relaxed">
          <Network className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <p>{t("organizations.create.people.teamsNote")}</p>
        </aside>
      </CardContent>
    </Card>
  );
}
