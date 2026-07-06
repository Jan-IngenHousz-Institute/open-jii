"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useRequestToJoin } from "@/hooks/organization/useOrganizationJoinMutations";
import { useOrganizationProfile } from "@/hooks/organization/useOrganizationProfile";
import { Building2, Check, Globe, Lock, MapPin, Users } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { NavTabs, NavTabsContent, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";
import { Skeleton } from "@repo/ui/components/skeleton";

import { OrganizationJoinRequestsPanel } from "./organization-join-requests-panel";
import { OrganizationResourcesShowcase } from "./organization-resources-showcase";
import { OrganizationSettings } from "./organization-settings";
import { OrganizationTeams } from "./organization-teams";

const TYPE_LABELS: Record<string, string> = {
  research_institute: "Research institute",
  non_profit: "Non-profit",
  private_company: "Company",
  government_agency: "Government",
  university: "University",
};

interface OrganizationProfileProps {
  organizationId: string;
}

/** Organization profile: public Overview + member-gated manage tabs. */
export function OrganizationProfile({ organizationId }: OrganizationProfileProps) {
  const { data, isLoading, error } = useOrganizationProfile(organizationId);
  const requestToJoin = useRequestToJoin();

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <ErrorDisplay error={error} title="Cannot view this organization" />
      </div>
    );
  }

  if (!data) return null;
  const org = data.body;
  const isMember = org.membershipStatus === "member";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start gap-4">
        <div className="bg-primary/10 text-primary grid h-16 w-16 shrink-0 place-items-center rounded-xl">
          <Building2 className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{org.name}</h1>
            <Badge variant="outline" className="gap-1">
              {org.visibility === "public" ? (
                <Globe className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {org.visibility}
            </Badge>
            {org.type && <Badge variant="secondary">{TYPE_LABELS[org.type] ?? org.type}</Badge>}
          </div>
          {org.description && <p className="text-muted-foreground text-sm">{org.description}</p>}
          <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {org.memberCount} {org.memberCount === 1 ? "member" : "members"}
            </span>
            {org.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {org.location}
              </span>
            )}
            {org.website && (
              <a
                href={org.website}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground underline"
              >
                {org.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {isMember ? (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3.5 w-3.5" />
              Member
            </Badge>
          ) : org.membershipStatus === "pending" ? (
            <Button variant="ghost" disabled className="gap-1">
              <Check className="h-4 w-4" />
              Requested
            </Button>
          ) : (
            org.visibility === "public" && (
              <Button
                disabled={requestToJoin.isPending}
                onClick={() => requestToJoin.mutate({ params: { id: org.id }, body: {} })}
              >
                Request to join
              </Button>
            )
          )}
        </div>
      </header>

      <NavTabs defaultValue="overview" className="w-full">
        <NavTabsList>
          <NavTabsTrigger value="overview">Overview</NavTabsTrigger>
          {isMember && <NavTabsTrigger value="members">Members</NavTabsTrigger>}
          {isMember && <NavTabsTrigger value="teams">Teams</NavTabsTrigger>}
          {isMember && <NavTabsTrigger value="requests">Requests</NavTabsTrigger>}
        </NavTabsList>

        <NavTabsContent value="overview">
          <OrganizationResourcesShowcase organizationId={org.id} isMember={isMember} />
        </NavTabsContent>

        {isMember && (
          <NavTabsContent value="members">
            <OrganizationSettings organizationId={org.id} />
          </NavTabsContent>
        )}

        {isMember && (
          <NavTabsContent value="teams">
            <OrganizationTeams organizationId={org.id} canManage />
          </NavTabsContent>
        )}

        {isMember && (
          <NavTabsContent value="requests">
            <OrganizationJoinRequestsPanel organizationId={org.id} />
          </NavTabsContent>
        )}
      </NavTabs>
    </div>
  );
}
