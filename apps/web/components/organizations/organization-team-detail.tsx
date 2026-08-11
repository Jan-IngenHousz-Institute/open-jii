"use client";

import { UserAvatar } from "@/components/user-avatar";
import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
import { useOrganizationMembers } from "@/hooks/organization/useOrganizationMembers/useOrganizationMembers";
import { useOrganizationTeamMembership } from "@/hooks/organization/useOrganizationTeamMembership/useOrganizationTeamMembership";
import { useOrganizationTeams } from "@/hooks/organization/useOrganizationTeams/useOrganizationTeams";
import { useLocale } from "@/hooks/useLocale";
import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { canManageRoster } from "./organization-roster-rules";
import { organizationTeamsPath } from "./organization-routes";

/**
 * One team's roster. Candidates are the organization's own members and nothing
 * else: a non-member cannot be on one of its teams, which is what keeps a team
 * grant from ever amounting to outside access.
 */
export function OrganizationTeamDetail({
  organizationId,
  teamId,
}: {
  organizationId: string;
  teamId: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();

  const { data: organization } = useOrganization(organizationId);
  const canManage = canManageRoster(organization?.role ?? null);

  const { data: teams, isPending, isError } = useOrganizationTeams(organizationId);
  const { data: roster } = useOrganizationMembers(organizationId);
  const { mutateAsync: changeMembership, isPending: isChanging } =
    useOrganizationTeamMembership(organizationId);

  const [selectedUserId, setSelectedUserId] = useState("");

  const team = teams?.find((candidate) => candidate.id === teamId);

  const candidates = useMemo(() => {
    const onTeam = new Set((team?.members ?? []).map((member) => member.userId));
    return (roster?.members ?? []).filter((member) => !onTeam.has(member.userId));
  }, [roster, team]);

  const submit = async (userId: string, action: "add" | "remove") => {
    try {
      await changeMembership({ teamId, userId, action });
      toast({
        description:
          action === "add"
            ? t("organizations.teams.memberAdded")
            : t("organizations.teams.memberRemoved"),
      });
      if (action === "add") setSelectedUserId("");
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.teams.membershipFailed"),
        variant: "destructive",
      });
    }
  };

  if (isError) {
    return <p className="text-destructive text-sm">{t("organizations.teams.loadFailed")}</p>;
  }

  if (isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm font-semibold">{t("organizations.teams.notFound")}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={organizationTeamsPath(locale, organizationId)}>
            <ArrowLeft className="h-4 w-4" />
            {t("organizations.teams.backToTeams")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="w-fit px-0">
        <Link href={organizationTeamsPath(locale, organizationId)}>
          <ArrowLeft className="h-4 w-4" />
          {t("organizations.teams.backToTeams")}
        </Link>
      </Button>

      {/* Header row, then the roster — the shape the members surface uses, with the
          management affordance beside the title rather than adrift above the list. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{team.name}</h2>
          <p className="text-muted-foreground text-sm">
            {t("organizations.teams.memberCount", { count: team.members.length })}
          </p>
        </div>

        {canManage && (
          <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row sm:items-center">
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={isChanging || candidates.length === 0}
            >
              <SelectTrigger
                className="sm:w-[280px]"
                aria-label={t("organizations.teams.addLabel")}
              >
                <SelectValue
                  placeholder={
                    candidates.length === 0
                      ? t("organizations.teams.allMembersOnTeam")
                      : t("organizations.teams.addPlaceholder")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {`${member.firstName} ${member.lastName}`.trim() ||
                      (member.email ?? member.userId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => void submit(selectedUserId, "add")}
              disabled={isChanging || selectedUserId === ""}
            >
              <Plus className="h-4 w-4" />
              {t("organizations.teams.addAction")}
            </Button>
          </div>
        )}
      </div>

      {team.members.length === 0 ? (
        <div className="border-border rounded-lg border px-6 py-10 text-center">
          <p className="text-foreground text-sm font-semibold">
            {t("organizations.teams.noMembersTitle")}
          </p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-[380px] text-xs leading-relaxed">
            {t("organizations.teams.noMembersHint")}
          </p>
        </div>
      ) : (
        <div
          role="list"
          className="border-border divide-border divide-y overflow-hidden rounded-lg border"
        >
          {team.members.map((member) => {
            const displayName =
              `${member.firstName} ${member.lastName}`.trim() || (member.email ?? member.userId);

            return (
              <div
                role="listitem"
                key={member.userId}
                className="flex items-center gap-3 px-4 py-3"
              >
                <UserAvatar
                  avatarUrl={member.avatarUrl}
                  firstName={member.firstName}
                  lastName={member.lastName}
                  className="h-9 w-9"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="text-muted-foreground truncate text-xs">{member.email}</p>
                </div>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void submit(member.userId, "remove")}
                    disabled={isChanging}
                    aria-label={t("organizations.teams.removeLabel", { name: displayName })}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
