"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { UserAvatar } from "@/components/user-avatar";
import { useDeleteOrganizationTeam } from "@/hooks/organization/useDeleteOrganizationTeam/useDeleteOrganizationTeam";
import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
import { useOrganizationMembers } from "@/hooks/organization/useOrganizationMembers/useOrganizationMembers";
import { useOrganizationTeamGrants } from "@/hooks/organization/useOrganizationTeamGrants/useOrganizationTeamGrants";
import { useOrganizationTeamMembership } from "@/hooks/organization/useOrganizationTeamMembership/useOrganizationTeamMembership";
import { useOrganizationTeams } from "@/hooks/organization/useOrganizationTeams/useOrganizationTeams";
import { useUpdateOrganizationTeam } from "@/hooks/organization/useUpdateOrganizationTeam/useUpdateOrganizationTeam";
import { useLocale } from "@/hooks/useLocale";
import { ArrowLeft, Pencil, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";

import type { OrganizationTeam } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { OrganizationConfirmDialog } from "./organization-confirm-dialog";
import { canManageRoster } from "./organization-roster-rules";
import { organizationTeamsPath } from "./organization-routes";
import { OrganizationTeamGrants } from "./organization-team-grants";

/**
 * One team's roster, plus what it reaches and the two decisions that belong to the
 * team itself rather than to the grid it came from — renaming and deleting.
 *
 * Candidates are the organization's own members and nothing else: a non-member cannot
 * be on one of its teams, which is what keeps a team grant from ever amounting to
 * outside access.
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
  const router = useRouter();

  const { data: organization } = useOrganization(organizationId);
  const canManage = canManageRoster(organization?.role ?? null);

  const { data: teams, isPending, isError } = useOrganizationTeams(organizationId);
  const { data: roster } = useOrganizationMembers(organizationId);
  const {
    data: grants,
    isPending: isGrantsPending,
    isError: isGrantsError,
  } = useOrganizationTeamGrants(organizationId);
  const { mutateAsync: changeMembership, isPending: isChanging } =
    useOrganizationTeamMembership(organizationId);
  const { mutateAsync: renameTeam, isPending: isRenaming } =
    useUpdateOrganizationTeam(organizationId);
  const { mutateAsync: deleteTeam, isPending: isDeleting } =
    useDeleteOrganizationTeam(organizationId);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [renameValue, setRenameValue] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

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

  const submitRename = async (current: OrganizationTeam) => {
    const name = (renameValue ?? "").trim();
    if (name.length === 0 || name === current.name) {
      setRenameValue(null);
      return;
    }
    try {
      await renameTeam({ teamId: current.id, name });
      toast({ description: t("organizations.teams.renamed", { name }) });
      setRenameValue(null);
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.teams.renameFailed"),
        variant: "destructive",
      });
    }
  };

  const confirmDeletion = async (current: OrganizationTeam) => {
    try {
      await deleteTeam({ teamId: current.id });
      toast({ description: t("organizations.teams.deleted", { name: current.name }) });
      setIsDeleteOpen(false);
      // The team no longer exists, so this route no longer resolves to anything.
      router.push(organizationTeamsPath(locale, organizationId));
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.teams.deleteFailed"),
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

  const isEditingName = renameValue !== null;

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <Link
        href={organizationTeamsPath(locale, organizationId)}
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-xs"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {t("organizations.teams.backToTeams")}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {isEditingName ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submitRename(team);
              }}
            >
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                aria-label={t("organizations.teams.renameLabel", { name: team.name })}
                disabled={isRenaming}
                autoFocus
                className="sm:w-[280px]"
              />
              <Button type="submit" size="sm" disabled={isRenaming}>
                {t("common.save")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isRenaming}
                onClick={() => setRenameValue(null)}
              >
                {t("common.cancel")}
              </Button>
            </form>
          ) : canManage ? (
            // The heading itself is the affordance: renaming a team is a correction,
            // not a decision, so it does not warrant a control of its own.
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRenameValue(team.name)}
              aria-label={t("organizations.teams.renameLabel", { name: team.name })}
              className="-mx-2 h-auto justify-start px-2 py-0.5 text-left"
            >
              <h2 className="truncate text-lg font-semibold tracking-tight">{team.name}</h2>
              <Pencil className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
            </Button>
          ) : (
            <h2 className="truncate text-lg font-semibold tracking-tight">{team.name}</h2>
          )}
          <p className="text-muted-foreground mt-1.5 text-sm">
            {t("organizations.teams.memberCount", { count: team.members.length })}
          </p>
          <DocsHelpLink path="/guide/organizations/teams" className="mt-1" />
        </div>

        {canManage && (
          <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row sm:items-center">
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={isChanging || candidates.length === 0}
            >
              <SelectTrigger
                className="sm:w-[240px]"
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
        <Card className="px-6 py-11 text-center">
          <p className="text-foreground text-sm font-semibold">
            {t("organizations.teams.noMembersTitle")}
          </p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-[380px] text-xs leading-relaxed">
            {t("organizations.teams.noMembersHint")}
          </p>
        </Card>
      ) : (
        <Card
          role="list"
          aria-label={t("organizations.members.title")}
          className="divide-border divide-y overflow-hidden"
        >
          {team.members.map((member) => {
            const displayName =
              `${member.firstName} ${member.lastName}`.trim() || (member.email ?? member.userId);

            return (
              <div
                role="listitem"
                key={member.userId}
                className="flex items-center gap-3 px-5 py-3"
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
        </Card>
      )}

      <OrganizationTeamGrants
        grants={(grants ?? []).filter((grant) => grant.teamId === teamId)}
        isPending={isGrantsPending}
        isError={isGrantsError}
      />

      {canManage && (
        <section className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <span className="text-destructive block text-sm font-semibold">
              {t("organizations.teams.deleteTitle")}
            </span>
            <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
              {t("organizations.teams.deleteNote")}
            </span>
          </div>
          <Button
            variant="destructive"
            className="shrink-0"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isDeleting}
          >
            {t("organizations.teams.deleteAction")}
          </Button>
        </section>
      )}

      <OrganizationConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title={t("organizations.teams.deleteTitle")}
        description={t("organizations.teams.deleteDescription", { name: team.name })}
        note={t("organizations.teams.deleteNote")}
        confirmLabel={t("common.delete")}
        pendingLabel={t("organizations.teams.deleting")}
        isPending={isDeleting}
        onConfirm={() => void confirmDeletion(team)}
      />
    </div>
  );
}
