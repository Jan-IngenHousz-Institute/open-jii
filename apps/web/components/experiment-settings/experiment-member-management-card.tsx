"use client";

import React from "react";

import type { ExperimentMember } from "@repo/api/schemas/experiment.schema";
import type { Invitation } from "@repo/api/schemas/user.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/card";
import {
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
} from "@repo/ui/components/underline-tabs";

import { useExperimentJoinRequests } from "../../hooks/experiment/join-request/useExperimentJoinRequests/useExperimentJoinRequests";
import { useUserInvitations } from "../../hooks/user-invitation/useUserInvitations/useUserInvitations";
import { ExperimentJoinRequestsPanel } from "./experiment-join-requests-panel";
import { ExperimentMembersPanel } from "./experiment-members-panel";
import { ExperimentPendingInvitationsPanel } from "./experiment-pending-invitations-panel";

interface ExperimentMemberManagementProps {
  experimentId: string;
  members: ExperimentMember[];
  isLoading: boolean;
  isError: boolean;
  isArchived?: boolean;
}

export function ExperimentMemberManagement({
  experimentId,
  members,
  isLoading,
  isError,
  isArchived = false,
}: ExperimentMemberManagementProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const currentUserId = session?.user.id;
  const currentMember = members.find((m) => m.user.id === currentUserId);
  const currentUserRole = currentMember?.role;
  const isAdmin = currentUserRole === "admin";
  const adminCount = members.filter((m) => m.role === "admin").length;

  const { data: invitationsData } = useUserInvitations("experiment", experimentId);
  const invitations: Invitation[] = invitationsData?.body ?? [];
  const { data: joinRequestsData } = useExperimentJoinRequests(experimentId);
  const joinRequests = joinRequestsData?.status === 200 ? joinRequestsData.body : [];

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle>{t("experimentSettings.memberManagement")}</CardTitle>
          <div className="bg-muted/40 h-6 w-32 rounded" />
        </CardHeader>
        <CardContent>
          <div className="bg-muted/40 h-64 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>{t("experimentSettings.memberManagement")}</CardTitle>
          <CardDescription className="text-destructive">
            {t("experimentSettings.memberManagementError")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle>{t("experimentSettings.collaborators")}</CardTitle>
        <CardDescription>{t("experimentSettings.collaboratorsDescription")}</CardDescription>
      </CardHeader>

      <CardContent>
        <UnderlineTabs defaultValue="members" className="w-full">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="members" count={members.length}>
              {t("experimentSettings.membersTab")}
            </UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="invited" count={invitations.length} disabled={!isAdmin}>
              {t("experimentSettings.invitedTab")}
            </UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="requests" count={joinRequests.length} disabled={!isAdmin}>
              {t("experimentSettings.requestsTab")}
            </UnderlineTabsTrigger>
          </UnderlineTabsList>

          <UnderlineTabsContent value="members" className="mt-4">
            <ExperimentMembersPanel
              experimentId={experimentId}
              members={members}
              invitations={invitations}
              currentUserRole={currentUserRole}
              currentUserId={currentUserId ?? ""}
              isArchived={isArchived}
              adminCount={adminCount}
            />
          </UnderlineTabsContent>

          <UnderlineTabsContent value="invited" className="mt-4">
            <ExperimentPendingInvitationsPanel
              invitations={invitations}
              isArchived={isArchived}
              isAdmin={isAdmin}
            />
          </UnderlineTabsContent>

          <UnderlineTabsContent value="requests" className="mt-4">
            <ExperimentJoinRequestsPanel experimentId={experimentId} joinRequests={joinRequests} />
          </UnderlineTabsContent>
        </UnderlineTabs>
      </CardContent>
    </>
  );
}
