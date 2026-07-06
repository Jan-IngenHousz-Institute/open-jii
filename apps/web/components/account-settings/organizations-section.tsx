"use client";

import { useLocale } from "@/hooks/useLocale";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";

/**
 * Lists the user's organizations and lets them pick the create-default org
 * (the one that owns resources they create). Active org is nav/create only.
 */
export function OrganizationsSection() {
  const { t } = useTranslation("account");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const orgs = organizations ?? [];

  const setDefault = async (organizationId: string) => {
    setPendingId(organizationId);
    try {
      await authClient.organization.setActive({ organizationId });
      await queryClient.invalidateQueries();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section aria-label={t("settings.organizations.title")} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-lg font-medium">{t("settings.organizations.title")}</h3>
          <p className="text-muted-foreground text-sm">{t("settings.organizations.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/platform/organizations`}>
              <Search className="mr-2 h-4 w-4" />
              {t("settings.organizations.browse")}
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/${locale}/platform/organizations/new`}>
              <Plus className="mr-2 h-4 w-4" />
              {t("settings.organizations.create")}
            </Link>
          </Button>
        </div>
      </div>

      {orgs.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("settings.organizations.empty")}</p>
      ) : (
        <ul className="divide-border divide-y rounded-md border">
          {orgs.map((org) => {
            const isDefault = org.id === activeOrganization?.id;
            return (
              <li key={org.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Building2 className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="truncate text-sm font-medium">{org.name}</span>
                  {isDefault && (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="h-3 w-3" />
                      {t("settings.organizations.default")}
                    </Badge>
                  )}
                </span>
                {!isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pendingId !== null}
                    onClick={() => void setDefault(org.id)}
                  >
                    {t("settings.organizations.setAsDefault")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
