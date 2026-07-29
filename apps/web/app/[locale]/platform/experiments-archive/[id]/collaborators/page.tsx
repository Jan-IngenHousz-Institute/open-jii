"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { ErrorDisplay } from "@/components/error-display";
import { ExperimentJoinRequestsPanel } from "@/components/experiment-settings/collaborators/experiment-join-requests-panel";
import { ExperimentPendingInvitationsPanel } from "@/components/experiment-settings/collaborators/experiment-pending-invitations-panel";
import { CollaboratorsList } from "@/components/sharing/collaborators-list";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useResourceCollaborators } from "@/hooks/sharing/useResourceCollaborators/useResourceCollaborators";
import { Search, UserPlus } from "lucide-react";
import { notFound } from "next/navigation";
import { use, useMemo, useState } from "react";
import { useExperimentJoinRequests } from "~/hooks/experiment/join-request/useExperimentJoinRequests/useExperimentJoinRequests";
import { useUserInvitations } from "~/hooks/user-invitation/useUserInvitations/useUserInvitations";
import { matchesGrantee } from "~/util/collaborator-filter";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { NavTabs, NavTabsContent, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

interface ExperimentCollaboratorsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * The archived twin of the collaborators surface: same layout, nothing writable.
 * An archived experiment is read-only by definition, so the invite action and
 * every row control are inert rather than hidden — who collaborated stays legible.
 */
export default function ExperimentCollaboratorsPage({ params }: ExperimentCollaboratorsPageProps) {
  const { id } = use(params);
  const { t } = useTranslation();

  const { data: accessData, isLoading, error } = useExperimentAccess(id);
  const experiment = accessData?.experiment;
  const canManage = accessData?.isAdmin ?? false;
  const canShare = accessData?.capabilities.canShare ?? false;

  // Both endpoints are can(share)-gated (the grants list, and invitee emails):
  // skip the request entirely when the capability signal already says it would 403.
  const { data: grantsData, isError: isGrantsError } = useResourceCollaborators("experiment", id, {
    enabled: canShare,
  });
  const grants = useMemo(() => grantsData ?? [], [grantsData]);

  const { data: invitationsData } = useUserInvitations("experiment", id, { enabled: canShare });
  const invitations = useMemo(() => invitationsData ?? [], [invitationsData]);

  const { data: joinRequestsData } = useExperimentJoinRequests(id);
  const joinRequests = useMemo(() => joinRequestsData ?? [], [joinRequestsData]);

  const [filter, setFilter] = useState("");

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

  if (experiment.status !== "archived") notFound();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{t("experimentSettings.collaborators")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("experimentSettings.collaboratorsDescription")}
        </p>
        <DocsHelpLink path="/guide/experiments/collaborators" className="mt-1" />
      </div>

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
        <Button disabled>
          <UserPlus className="h-4 w-4" />
          {t("experimentSettings.invite")}
        </Button>
      </div>

      <NavTabs defaultValue={canShare ? "collaborators" : "requests"} className="w-full">
        <NavTabsList>
          {canShare && (
            <NavTabsTrigger value="collaborators" count={filteredGrants.length}>
              {t("experimentSettings.collaboratorsTab")}
            </NavTabsTrigger>
          )}
          {canShare && (
            <NavTabsTrigger value="invited" count={filteredInvitations.length}>
              {t("experimentSettings.invitedTab")}
            </NavTabsTrigger>
          )}
          <NavTabsTrigger value="requests" count={filteredJoinRequests.length}>
            {t("experimentSettings.requestsTab")}
          </NavTabsTrigger>
        </NavTabsList>

        {canShare && (
          <NavTabsContent value="collaborators">
            <CollaboratorsList
              resourceType="experiment"
              resourceId={id}
              grants={filteredGrants}
              isError={isGrantsError}
              readOnly
              isFiltered={normalizedFilter.length > 0}
            />
          </NavTabsContent>
        )}

        {canShare && (
          <NavTabsContent value="invited">
            <ExperimentPendingInvitationsPanel
              invitations={filteredInvitations}
              isArchived
              canRevoke={canShare}
            />
          </NavTabsContent>
        )}

        <NavTabsContent value="requests">
          <ExperimentJoinRequestsPanel
            experimentId={id}
            joinRequests={filteredJoinRequests}
            isAdmin={canManage}
            isArchived
          />
        </NavTabsContent>
      </NavTabs>
    </div>
  );
}
