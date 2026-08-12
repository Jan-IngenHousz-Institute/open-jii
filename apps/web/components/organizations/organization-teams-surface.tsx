"use client";

import { UserAvatar } from "@/components/user-avatar";
import { useCreateOrganizationTeam } from "@/hooks/organization/useCreateOrganizationTeam/useCreateOrganizationTeam";
import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
import { useOrganizationTeamGrants } from "@/hooks/organization/useOrganizationTeamGrants/useOrganizationTeamGrants";
import { useOrganizationTeams } from "@/hooks/organization/useOrganizationTeams/useOrganizationTeams";
import { useLocale } from "@/hooks/useLocale";
import { FolderOpen, Network, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";

import type { OrganizationTeamMember } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { canManageRoster } from "./organization-roster-rules";
import { organizationTeamPath } from "./organization-routes";

/** How many faces a card shows before the rest become a count. */
const AVATAR_LIMIT = 4;

/**
 * Teams of one organization. A team is a named subset of its members and nothing
 * more: it exists to be granted access to resources as a unit, which is why deleting
 * one also removes the grants naming it — done server-side, so a team never leaves a
 * ghost collaborator row behind.
 *
 * Cards rather than list rows, because what matters about a team is its shape — who
 * is on it and how much it reaches — and a row has nowhere to put either. Renaming
 * and deleting live on the team's own page: they are decisions about one team, and a
 * grid of cards each carrying two icon buttons invites the wrong click.
 */
export function OrganizationTeamsSurface({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();

  const { data: organization } = useOrganization(organizationId);
  const canManage = canManageRoster(organization?.role ?? null);

  const { data, isPending, isError } = useOrganizationTeams(organizationId);
  const { data: grants } = useOrganizationTeamGrants(organizationId);
  const { mutateAsync: createTeam, isPending: isCreating } =
    useCreateOrganizationTeam(organizationId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  const teams = data ?? [];

  const grantCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const grant of grants ?? []) {
      counts.set(grant.teamId, (counts.get(grant.teamId) ?? 0) + 1);
    }
    return counts;
  }, [grants]);

  const submitNewTeam = async () => {
    const name = newTeamName.trim();
    if (name.length === 0) return;
    try {
      await createTeam({ name });
      toast({ description: t("organizations.teams.created", { name }) });
      setNewTeamName("");
      setIsCreateOpen(false);
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.teams.createFailed"),
        variant: "destructive",
      });
    }
  };

  if (isError) {
    return <p className="text-destructive text-sm">{t("organizations.teams.loadFailed")}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{t("organizations.teams.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("organizations.teams.description")}</p>
        </div>

        {canManage && !isCreateOpen && (
          <Button className="shrink-0" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("organizations.teams.createAction")}
          </Button>
        )}
      </div>

      {isPending ? (
        <div aria-busy="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((card) => (
            <Skeleton key={card} className="h-[148px]" />
          ))}
        </div>
      ) : teams.length === 0 && !isCreateOpen ? (
        <Card className="px-6 py-11 text-center">
          <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
            <Network className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-foreground text-sm font-semibold">
            {t("organizations.teams.emptyTitle")}
          </p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-[380px] text-xs leading-relaxed">
            {canManage
              ? t("organizations.teams.emptyManagerHint")
              : t("organizations.teams.emptyMemberHint")}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* The new team takes a slot in the grid rather than a form above it, so the
              card being filled in sits where the card will be. */}
          {canManage && isCreateOpen && (
            <Card className="border-primary bg-primary/5 border-dashed p-5 shadow-none">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitNewTeam();
                }}
              >
                <span className="text-primary mb-2.5 block text-[11px] font-semibold uppercase tracking-wider">
                  {t("organizations.teams.createAction")}
                </span>
                <Input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder={t("organizations.teams.namePlaceholder")}
                  aria-label={t("organizations.teams.nameLabel")}
                  disabled={isCreating}
                  autoFocus
                />
                <div className="mt-3 flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isCreating || newTeamName.trim().length === 0}
                  >
                    {isCreating
                      ? t("organizations.teams.creating")
                      : t("organizations.teams.createAction")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isCreating}
                    onClick={() => {
                      setIsCreateOpen(false);
                      setNewTeamName("");
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {teams.map((team) => (
            <Link
              key={team.id}
              href={organizationTeamPath(locale, organizationId, team.id)}
              // The platform's card hover, verbatim: every listing card — experiments,
              // protocols, macros, organizations — lifts and shadows without changing
              // its border. The design's border tint was prototype styling.
              className="bg-card shadow-xs flex flex-col gap-3.5 rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg"
            >
              <div className="min-w-0">
                <span className="block truncate text-base font-semibold tracking-tight">
                  {team.name}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {t("organizations.teams.memberCount", { count: team.members.length })}
                </span>
              </div>

              <AvatarStack members={team.members} />

              <div className="text-muted-foreground flex items-center gap-1.5 border-t pt-3 text-xs">
                <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t("organizations.teams.grantCount", { count: grantCounts.get(team.id) ?? 0 })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The first few faces on a team, overlapped. Purely decorative: the count beside it
 * says the same thing in words, so the stack is hidden from assistive tech rather
 * than read out as a list of unlabelled images.
 */
function AvatarStack({ members }: { members: OrganizationTeamMember[] }) {
  const shown = members.slice(0, AVATAR_LIMIT);
  const extra = members.length - shown.length;

  // An empty team has no stack, and mt-auto keeps the footer on the card's bottom.
  if (shown.length === 0) return <div className="mt-auto" />;

  return (
    <div className="mt-auto flex items-center" aria-hidden>
      {shown.map((member) => (
        <UserAvatar
          key={member.userId}
          avatarUrl={member.avatarUrl}
          firstName={member.firstName}
          lastName={member.lastName}
          className="ring-card -mr-1.5 h-7 w-7 ring-2"
        />
      ))}
      {extra > 0 ? (
        <span className="text-muted-foreground ml-3 text-[11px] tabular-nums">+{extra}</span>
      ) : null}
    </div>
  );
}
