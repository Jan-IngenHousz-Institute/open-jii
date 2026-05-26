"use client";

import { ErrorDisplay } from "@/components/error-display";
import { ExperimentInviteModal } from "@/components/experiment-settings/collaborators/experiment-invite-modal";
import { ExperimentJoinRequestsPanel } from "@/components/experiment-settings/collaborators/experiment-join-requests-panel";
import { ExperimentMembersPanel } from "@/components/experiment-settings/collaborators/experiment-members-panel";
import { ExperimentPendingInvitationsPanel } from "@/components/experiment-settings/collaborators/experiment-pending-invitations-panel";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentMembers } from "@/hooks/experiment/useExperimentMembers/useExperimentMembers";
import { Search, UserPlus } from "lucide-react";
import { notFound } from "next/navigation";
import { use, useMemo, useState } from "react";
import { useExperimentJoinRequests } from "~/hooks/experiment/join-request/useExperimentJoinRequests/useExperimentJoinRequests";
import { useUserInvitations } from "~/hooks/user-invitation/useUserInvitations/useUserInvitations";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { NavTabs, NavTabsContent, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

interface ExperimentCollaboratorsPageProps {
  params: Promise<{ id: string }>;
}

export default function ExperimentCollaboratorsPage({ params }: ExperimentCollaboratorsPageProps) {
  const { id } = use(params);
  const { t } = useTranslation();

  const { data: accessData, isLoading, error } = useExperimentAccess(id);
  const experiment = accessData?.body.experiment;

  const { data: membersData, isError: isMembersError } = useExperimentMembers(id);
  const members = useMemo(() => membersData?.body ?? [], [membersData]);

  const { data: invitationsData } = useUserInvitations("experiment", id);
  const invitations = useMemo(() => invitationsData?.body ?? [], [invitationsData]);

  const { data: joinRequestsData } = useExperimentJoinRequests(id);
  const joinRequests = useMemo(
    () => (joinRequestsData?.status === 200 ? joinRequestsData.body : []),
    [joinRequestsData],
  );

  const { data: session } = useSession();
  const currentUserId = session?.user.id;
  const currentMember = members.find((m) => m.user.id === currentUserId);
  const currentUserRole = currentMember?.role;
  const isAdmin = currentUserRole === "admin";
  const adminCount = members.filter((m) => m.role === "admin").length;

  const [filter, setFilter] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const normalizedFilter = filter.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    if (!normalizedFilter) return members;
    return members.filter((m) => {
      const name = `${m.user.firstName} ${m.user.lastName}`.toLowerCase();
      const email = (m.user.email ?? "").toLowerCase();
      return name.includes(normalizedFilter) || email.includes(normalizedFilter);
    });
  }, [members, normalizedFilter]);

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
        <Button onClick={() => setIsInviteOpen(true)} disabled>
          <UserPlus className="h-4 w-4" />
          {t("experimentSettings.invite")}
        </Button>
      </div>

      <NavTabs defaultValue="members" className="w-full">
        <NavTabsList>
          <NavTabsTrigger value="members" count={filteredMembers.length}>
            {t("experimentSettings.membersTab")}
          </NavTabsTrigger>
          <NavTabsTrigger value="invited" count={filteredInvitations.length}>
            {t("experimentSettings.invitedTab")}
          </NavTabsTrigger>
          <NavTabsTrigger value="requests" count={filteredJoinRequests.length}>
            {t("experimentSettings.requestsTab")}
          </NavTabsTrigger>
        </NavTabsList>

        <NavTabsContent value="members">
          {isMembersError ? (
            <p className="text-destructive text-sm">
              {t("experimentSettings.memberManagementError")}
            </p>
          ) : (
            <ExperimentMembersPanel
              experimentId={id}
              members={filteredMembers}
              currentUserRole={currentUserRole}
              currentUserId={currentUserId ?? ""}
              isArchived
              adminCount={adminCount}
              isAddingMember={isAddingMember}
            />
          )}
        </NavTabsContent>

        <NavTabsContent value="invited">
          <ExperimentPendingInvitationsPanel
            invitations={filteredInvitations}
            isArchived
            isAdmin={isAdmin}
          />
        </NavTabsContent>

        <NavTabsContent value="requests">
          <ExperimentJoinRequestsPanel
            experimentId={id}
            joinRequests={filteredJoinRequests}
            isAdmin={isAdmin}
            isArchived
          />
        </NavTabsContent>
      </NavTabs>

      <ExperimentInviteModal
        experimentId={id}
        members={members}
        invitations={invitations}
        isArchived
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        onIsAddingMemberChange={setIsAddingMember}
      />
    </div>
  );
}
