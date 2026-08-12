"use client";

import { useOrganizationJoinRequests } from "@/hooks/organization/join-request/useOrganizationJoinRequests/useOrganizationJoinRequests";
import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
import { useOrganizationInvitations } from "@/hooks/organization/useOrganizationInvitations/useOrganizationInvitations";
import { useOrganizationMembers } from "@/hooks/organization/useOrganizationMembers/useOrganizationMembers";
import { useOrganizationTeams } from "@/hooks/organization/useOrganizationTeams/useOrganizationTeams";
import { useMemo, useState } from "react";

import type { OrganizationRole } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { liveInvitations } from "./organization-invitation-state";
import { OrganizationInvitations } from "./organization-invitations";
import { OrganizationJoinRequests } from "./organization-join-requests";
import { OrganizationRoster } from "./organization-roster";
import { canManageRoster } from "./organization-roster-rules";

/** Which of the three views of "who is in this organization" is showing. */
type MemberView = "members" | "invited" | "requests";

/**
 * Members, Invited and Requests as one strip rather than three routes: they are
 * three views of the same question — who is in this organization and who wants to
 * be. Segmented buttons rather than a second tab row, so the organization's own tabs
 * stay the only underlined strip on the page.
 *
 * Invited and Requests are owner/admin surfaces, so a plain member sees only the
 * roster; the endpoints behind them refuse independently. Inviting lives in the
 * organization's header band, reachable from every one of its routes.
 */
export function OrganizationMembersSurface({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();

  const { data: organization } = useOrganization(organizationId);
  const actorRole: OrganizationRole | null = organization?.role ?? null;
  const canManage = canManageRoster(actorRole);

  const {
    data: roster,
    isPending: isRosterPending,
    isError: isRosterError,
  } = useOrganizationMembers(organizationId);
  // Skip the requests behind an affordance this caller does not have; a known
  // `false` is a refusal waiting to happen, not information.
  const { data: invitations } = useOrganizationInvitations(organizationId, { enabled: canManage });
  const { data: joinRequests } = useOrganizationJoinRequests(organizationId, {
    enabled: canManage,
  });
  // The teams already carry their members, so which teams a person is on is a
  // client-side join rather than a per-row read.
  const { data: teams } = useOrganizationTeams(organizationId);

  const [view, setView] = useState<MemberView>("members");

  const members = roster?.members ?? [];
  const liveInvitationCount = liveInvitations(invitations).length;
  const pendingRequestCount = (joinRequests ?? []).filter(
    (request) => request.status === "pending",
  ).length;

  const teamNamesByUserId = useMemo(() => {
    const names = new Map<string, string[]>();
    for (const team of teams ?? []) {
      for (const member of team.members) {
        names.set(member.userId, [...(names.get(member.userId) ?? []), team.name]);
      }
    }
    return names;
  }, [teams]);

  // A plain member has one view, so the strip is not offered to them at all.
  const activeView: MemberView = canManage ? view : "members";

  const segments: { value: MemberView; label: string; count: number }[] = [
    { value: "members", label: t("organizations.tabs.members"), count: members.length },
    { value: "invited", label: t("organizations.invite.label"), count: liveInvitationCount },
    { value: "requests", label: t("organizations.requests.label"), count: pendingRequestCount },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            {t("organizations.members.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {canManage
              ? t("organizations.members.description")
              : t("organizations.members.memberDescription")}
          </p>
        </div>

        {/* Toggle buttons, not tabs: a `tab` role promises arrow-key navigation and a
            linked `tabpanel`, and these are three buttons that swap the body. */}
        {canManage && (
          <div
            role="group"
            aria-label={t("organizations.members.title")}
            className="flex shrink-0 gap-1.5"
          >
            {segments.map((segment) => (
              <Button
                key={segment.value}
                type="button"
                aria-pressed={activeView === segment.value}
                variant={activeView === segment.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView(segment.value)}
              >
                {segment.label}
                <span className="text-muted-foreground ml-1 tabular-nums">{segment.count}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {activeView === "members" && (
        <OrganizationRoster
          organizationId={organizationId}
          members={members}
          actorRole={actorRole ?? "member"}
          teamNamesByUserId={teamNamesByUserId}
          isPending={isRosterPending}
          isError={isRosterError}
        />
      )}
      {activeView === "invited" && <OrganizationInvitations organizationId={organizationId} />}
      {activeView === "requests" && <OrganizationJoinRequests organizationId={organizationId} />}
    </div>
  );
}
