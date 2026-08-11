"use client";

import { useCreateOrganizationTeam } from "@/hooks/organization/useCreateOrganizationTeam/useCreateOrganizationTeam";
import { useDeleteOrganizationTeam } from "@/hooks/organization/useDeleteOrganizationTeam/useDeleteOrganizationTeam";
import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
import { useOrganizationTeams } from "@/hooks/organization/useOrganizationTeams/useOrganizationTeams";
import { useUpdateOrganizationTeam } from "@/hooks/organization/useUpdateOrganizationTeam/useUpdateOrganizationTeam";
import { useLocale } from "@/hooks/useLocale";
import { Pencil, Trash2, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";

import type { OrganizationTeam } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { OrganizationConfirmDialog } from "./organization-confirm-dialog";
import { canManageRoster } from "./organization-roster-rules";
import { organizationTeamPath } from "./organization-routes";

/**
 * Teams of one organization. A team is a named subset of its members and nothing
 * more: it exists to be granted access to resources as a unit, which is why
 * deleting one also removes the grants naming it — done server-side, so a team
 * never leaves a ghost collaborator row behind.
 */
export function OrganizationTeamsSurface({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();

  const { data: organization } = useOrganization(organizationId);
  const canManage = canManageRoster(organization?.role ?? null);

  const { data, isPending, isError } = useOrganizationTeams(organizationId);
  const { mutateAsync: createTeam, isPending: isCreating } =
    useCreateOrganizationTeam(organizationId);
  const { mutateAsync: renameTeam } = useUpdateOrganizationTeam(organizationId);
  const { mutateAsync: deleteTeam, isPending: isDeleting } =
    useDeleteOrganizationTeam(organizationId);

  const [newTeamName, setNewTeamName] = useState("");
  const [renamingTeamId, setRenamingTeamId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDeletion, setPendingDeletion] = useState<OrganizationTeam | null>(null);

  const teams = data ?? [];

  const submitNewTeam = async () => {
    const name = newTeamName.trim();
    if (name.length === 0) return;
    try {
      await createTeam({ name });
      toast({ description: t("organizations.teams.created", { name }) });
      setNewTeamName("");
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.teams.createFailed"),
        variant: "destructive",
      });
    }
  };

  const submitRename = async (team: OrganizationTeam) => {
    const name = renameValue.trim();
    if (name.length === 0 || name === team.name) {
      setRenamingTeamId(null);
      return;
    }
    try {
      await renameTeam({ teamId: team.id, name });
      toast({ description: t("organizations.teams.renamed", { name }) });
      setRenamingTeamId(null);
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.teams.renameFailed"),
        variant: "destructive",
      });
    }
  };

  const confirmDeletion = async () => {
    if (!pendingDeletion) return;
    try {
      await deleteTeam({ teamId: pendingDeletion.id });
      toast({ description: t("organizations.teams.deleted", { name: pendingDeletion.name }) });
      setPendingDeletion(null);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("organizations.teams.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("organizations.teams.description")}</p>
      </div>

      {canManage && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void submitNewTeam();
          }}
        >
          <Input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder={t("organizations.teams.namePlaceholder")}
            aria-label={t("organizations.teams.nameLabel")}
            disabled={isCreating}
            className="sm:max-w-sm"
          />
          <Button type="submit" disabled={isCreating || newTeamName.trim().length === 0}>
            {isCreating ? t("organizations.teams.creating") : t("organizations.teams.createAction")}
          </Button>
        </form>
      )}

      {isPending ? (
        <div
          aria-busy="true"
          className="border-border divide-border divide-y overflow-hidden rounded-lg border"
        >
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="border-border rounded-lg border px-6 py-10 text-center">
          <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
            <UsersRound className="h-5 w-5" />
          </div>
          <p className="text-foreground text-sm font-semibold">
            {t("organizations.teams.emptyTitle")}
          </p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-[380px] text-xs leading-relaxed">
            {canManage
              ? t("organizations.teams.emptyManagerHint")
              : t("organizations.teams.emptyMemberHint")}
          </p>
        </div>
      ) : (
        <div
          role="list"
          className="border-border divide-border divide-y overflow-hidden rounded-lg border"
        >
          {teams.map((team) => (
            <div role="listitem" key={team.id} className="flex items-center gap-3 px-4 py-3">
              <div className="bg-surface text-muted-foreground grid h-9 w-9 shrink-0 place-items-center rounded-full border">
                <Users className="h-4 w-4" />
              </div>

              {renamingTeamId === team.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitRename(team);
                  }}
                >
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    aria-label={t("organizations.teams.renameLabel", { name: team.name })}
                    autoFocus
                  />
                  <Button type="submit" size="sm">
                    {t("common.save")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRenamingTeamId(null)}
                  >
                    {t("common.cancel")}
                  </Button>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={organizationTeamPath(locale, organizationId, team.id)}
                      className="text-sm font-medium hover:underline"
                    >
                      {team.name}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {t("organizations.teams.memberCount", { count: team.members.length })}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setRenamingTeamId(team.id);
                          setRenameValue(team.name);
                        }}
                        aria-label={t("organizations.teams.renameLabel", { name: team.name })}
                        className="text-muted-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setPendingDeletion(team)}
                        aria-label={t("organizations.teams.deleteLabel", { name: team.name })}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <OrganizationConfirmDialog
        open={pendingDeletion !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null);
        }}
        title={t("organizations.teams.deleteTitle")}
        description={t("organizations.teams.deleteDescription", {
          name: pendingDeletion?.name ?? "",
        })}
        note={t("organizations.teams.deleteNote")}
        confirmLabel={t("common.delete")}
        pendingLabel={t("organizations.teams.deleting")}
        isPending={isDeleting}
        onConfirm={() => void confirmDeletion()}
      />
    </div>
  );
}
