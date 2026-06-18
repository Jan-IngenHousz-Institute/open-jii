"use client";

import { useRequestToJoin } from "@/hooks/organization/useOrganizationJoinMutations";
import { useLocale } from "@/hooks/useLocale";
import { Building2, Check, Globe, Lock, Users } from "lucide-react";
import Link from "next/link";

import type { OrganizationSummary } from "@repo/api/schemas/organization.schema";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";

const TYPE_LABELS: Record<string, string> = {
  research_institute: "Research institute",
  non_profit: "Non-profit",
  private_company: "Company",
  government_agency: "Government",
  university: "University",
};

interface OrganizationCardProps {
  organization: OrganizationSummary;
}

/** A directory card: org identity, type/visibility, member count, and a join CTA. */
export function OrganizationCard({ organization: org }: OrganizationCardProps) {
  const locale = useLocale();
  const requestToJoin = useRequestToJoin();
  const href = `/${locale}/platform/organizations/${org.id}`;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <div className="bg-primary/10 text-primary grid h-10 w-10 shrink-0 place-items-center rounded-lg">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <Link href={href} className="hover:underline">
            <h3 className="truncate font-semibold" title={org.name}>
              {org.name}
            </h3>
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {org.type && <Badge variant="secondary">{TYPE_LABELS[org.type] ?? org.type}</Badge>}
            <Badge variant="outline" className="gap-1">
              {org.visibility === "public" ? (
                <Globe className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {org.visibility}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {org.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{org.description}</p>
        )}
        <div className="text-muted-foreground mt-auto flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {org.memberCount} {org.memberCount === 1 ? "member" : "members"}
          </span>
          {org.membershipStatus === "member" ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href}>Open</Link>
            </Button>
          ) : org.membershipStatus === "pending" ? (
            <Button variant="ghost" size="sm" disabled className="gap-1">
              <Check className="h-3.5 w-3.5" />
              Requested
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={requestToJoin.isPending}
              onClick={() => requestToJoin.mutate({ params: { id: org.id }, body: {} })}
            >
              Request to join
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
