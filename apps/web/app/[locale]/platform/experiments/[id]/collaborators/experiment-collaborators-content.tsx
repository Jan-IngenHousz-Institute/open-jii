"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { ErrorDisplay } from "@/components/error-display";
import { ExperimentInviteModal } from "@/components/experiment-settings/collaborators/experiment-invite-modal";
import { ExperimentJoinRequestsPanel } from "@/components/experiment-settings/collaborators/experiment-join-requests-panel";
import { ExperimentPendingInvitationsPanel } from "@/components/experiment-settings/collaborators/experiment-pending-invitations-panel";
import { ExperimentRequestToJoin } from "@/components/experiment-settings/collaborators/experiment-request-to-join";
import { CollaboratorsList } from "@/components/sharing/collaborators-list";
import { LeaveResourceCard } from "@/components/sharing/leave-resource-card";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useResourceCollaborators } from "@/hooks/sharing/useResourceCollaborators/useResourceCollaborators";
import { Search, UserPlus } from "lucide-react";
import { notFound } from "next/navigation";
import { use, useMemo, useState } from "react";
import { useExperimentJoinRequests } from "~/hooks/experiment/join-request/useExperimentJoinRequests/useExperimentJoinRequests";
import { useUserInvitations } from "~/hooks/user-invitation/useUserInvitations/useUserInvitations";
import { matchesGrantee } from "~/util/collaborator-filter";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { NavTabs, NavTabsContent, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

interface ExperimentCollaboratorsPageProps {
  params: Promise<{ id: string }>;
}

/** Capability-gated collaborators, invitations, and join-request tabs. */
export default function ExperimentCollaboratorsPage({ params }: ExperimentCollaboratorsPageProps) {
  const { id } = use(params);
  const { t } = useTranslation();
  const { data: session } = useSession();

  const { data: accessData, isLoading, error } = useExperimentAccess(id);
  const experiment = accessData?.experiment;
  // Managing who collaborates is `can(share)` — a different question from
  // `can(manage)`, which owns the experiment's own settings.
  const canManage = accessData?.isAdmin ?? false;
  const canContribute = accessData?.capabilities.canContribute ?? false;
  const canShare = accessData?.capabilities.canShare ?? false;
  const canLeave = accessData?.capabilities.canLeave ?? false;

  // Both endpoints below are can(share)-gated: skip the request entirely when the
  // capability signal already says it would 403.
  const {
    data: grantsData,
    isError: isGrantsError,
    isPending: isGrantsPending,
  } = useResourceCollaborators("experiment", id, {
    enabled: canShare,
  });
  const grants = useMemo(() => grantsData ?? [], [grantsData]);

  const { data: invitationsData } = useUserInvitations("experiment", id, { enabled: canShare });
  const invitations = useMemo(() => invitationsData ?? [], [invitationsData]);

  // Same for join requests, which the server guards on can(manage).
  const { data: joinRequestsData } = useExperimentJoinRequests(id, { enabled: canManage });
  const joinRequests = useMemo(() => joinRequestsData ?? [], [joinRequestsData]);

  const isArchived = experiment?.status === "archived";

  // With neither capability there is no tab to show, which also leaves the filter
  // nothing to filter and the invite action nothing to do.
  const hasTabs = canShare || canManage;

  const [filter, setFilter] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const normalizedFilter = filter.trim().toLowerCase();

  const filteredGrants = useMemo(() => {
    if (!normalizedFilter) return grants;
    return grants.filter((grant) => matchesGrantee(grant.grantee, normalizedFilter));
  }, [grants, normalizedFilter]);

  const filteredInvitations = useMemo(() => {
    if (!normalizedFilter) return invitations;
    return invitations.filter((inv) => inv.email.toLowerCase().includes(normalizedFilter));
  }, [invitations, normalizedFilter]);

  const filteredJoinRequests = useMemo(() => {
    if (!normalizedFilter) return joinRequests;
    return joinRequests.filter((r) => {
      const name = `${r.user.firstName} ${r.user.lastName}`.toLowerCase();
      const email = (r.user.email ?? "").toLowerCase();
      return name.includes(normalizedFilter) || email.includes(normalizedFilter);
    });
  }, [joinRequests, normalizedFilter]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <div className="text-muted-foreground p-8 text-center">
          {t("experimentSettings.loading")}
        </div>
      </div>
    );
  }

  if (error) {
    const errorObj = error as { status?: number };
    if (errorObj.status === 404 || errorObj.status === 400) notFound();
    return (
      <div className="mx-auto w-full max-w-7xl">
        <ErrorDisplay error={error} />
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <div className="text-muted-foreground p-8 text-center">
          {t("experimentSettings.notFound")}
        </div>
      </div>
    );
  }

  const canRequestToJoin =
    session?.user.id && !canContribute && !isArchived && experiment.visibility === "public";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{t("experimentSettings.collaborators")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("experimentSettings.collaboratorsDescription")}
        </p>
        <DocsHelpLink path="/guide/experiments/collaborators" className="mt-1" />
      </div>

      {canRequestToJoin ? (
        <div className="rounded-md border p-4">
          <ExperimentRequestToJoin experimentId={id} />
        </div>
      ) : null}

      {hasTabs && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("experimentSettings.filterCollaboratorsPlaceholder")}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setIsInviteOpen(true)} disabled={isArchived || !canShare}>
            <UserPlus className="h-4 w-4" />
            {t("experimentSettings.invite")}
          </Button>
        </div>
      )}

      {hasTabs && (
        <NavTabs defaultValue={canShare ? "collaborators" : "requests"} className="w-full">
          <NavTabsList>
            {canShare && (
              // No badge until the list has answered: a `0` is a claim about the
              // resource, and rendering it from an empty placeholder array shows
              // "0" on an experiment that has collaborators.
              <NavTabsTrigger
                value="collaborators"
                count={isGrantsPending ? undefined : filteredGrants.length}
              >
                {t("experimentSettings.collaboratorsTab")}
              </NavTabsTrigger>
            )}
            {canShare && (
              <NavTabsTrigger value="invited" count={filteredInvitations.length}>
                {t("experimentSettings.invitedTab")}
              </NavTabsTrigger>
            )}
            {canManage && (
              <NavTabsTrigger value="requests" count={filteredJoinRequests.length}>
                {t("experimentSettings.requestsTab")}
              </NavTabsTrigger>
            )}
          </NavTabsList>

          {canShare && (
            <NavTabsContent value="collaborators">
              <CollaboratorsList
                resourceType="experiment"
                resourceId={id}
                grants={filteredGrants}
                isError={isGrantsError}
                isPending={isGrantsPending}
                readOnly={isArchived}
                isFiltered={normalizedFilter.length > 0}
              />
            </NavTabsContent>
          )}

          {canShare && (
            <NavTabsContent value="invited">
              <ExperimentPendingInvitationsPanel
                invitations={filteredInvitations}
                isArchived={isArchived}
                canRevoke={canShare}
              />
            </NavTabsContent>
          )}

          {canManage && (
            <NavTabsContent value="requests">
              <ExperimentJoinRequestsPanel
                experimentId={id}
                joinRequests={filteredJoinRequests}
                isAdmin={canManage}
                isArchived={isArchived}
              />
            </NavTabsContent>
          )}
        </NavTabs>
      )}

      {/* Grantees below `share` can't see the collaborators list, so they have
          no row to self-revoke — this card is their way out (the pre-grants
          members UI let any member leave). Share-capable users leave via their
          own row instead. */}
      {!canShare && canLeave && (
        <LeaveResourceCard resourceType="experiment" resourceId={id} disabled={isArchived} />
      )}

      <ExperimentInviteModal
        experimentId={id}
        invitations={invitations}
        existingGranteeIds={grants.map((grant) => grant.granteeId)}
        isArchived={isArchived}
        canShare={canShare}
        isPublic={experiment.visibility === "public"}
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
      />
    </div>
  );
}
