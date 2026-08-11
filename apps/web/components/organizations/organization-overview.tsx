"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
import { useOrganizationResources } from "@/hooks/organization/useOrganizationResources/useOrganizationResources";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { FolderOpen } from "lucide-react";
import Link from "next/link";

import type { OrganizationResource } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";

/** Where each showcased resource type lives on the platform. */
const RESOURCE_SEGMENT: Record<OrganizationResource["type"], string> = {
  experiment: "experiments",
  macro: "macros",
  protocol: "protocols",
  workbook: "workbooks",
};

/**
 * The organization's resources, scoped server-side by what the caller may read: an
 * outsider on a public organization sees its public work, a member sees everything
 * they have access to. The client draws no distinction — there is nothing here it
 * could filter that the server has not already decided.
 */
export function OrganizationOverview({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();

  const { data: organization } = useOrganization(organizationId);
  const { data, isPending, isError } = useOrganizationResources(organizationId);

  const resources = data?.resources ?? [];
  const isMember = organization?.role != null;

  return (
    <section className="flex flex-col gap-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("organizations.resources.title")}</h2>
        <p className="text-muted-foreground text-sm">
          {isMember
            ? t("organizations.resources.memberDescription")
            : t("organizations.resources.visitorDescription")}
        </p>
        <DocsHelpLink path="/guide/organizations" className="mt-1" />
      </div>

      {isError ? (
        <p className="text-destructive text-sm">{t("organizations.resources.loadFailed")}</p>
      ) : isPending ? (
        <div
          aria-busy="true"
          className="border-border divide-border divide-y overflow-hidden rounded-lg border"
        >
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="border-border rounded-lg border px-6 py-10 text-center">
          <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
            <FolderOpen className="h-5 w-5" />
          </div>
          <p className="text-foreground text-sm font-semibold">
            {t("organizations.resources.emptyTitle")}
          </p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-[380px] text-xs leading-relaxed">
            {isMember
              ? t("organizations.resources.emptyMemberHint")
              : t("organizations.resources.emptyVisitorHint")}
          </p>
        </div>
      ) : (
        <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {resources.map((resource) => (
            <li
              key={`${resource.type}-${resource.id}`}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/${locale}/platform/${RESOURCE_SEGMENT[resource.type]}/${resource.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {resource.name}
                </Link>
                {resource.description ? (
                  <p className="text-muted-foreground line-clamp-1 text-xs">
                    {resource.description}
                  </p>
                ) : null}
                <p className="text-muted-foreground text-xs">
                  {t("common.updated")} {formatDate(resource.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {resource.visibility === "private" ? (
                  <Badge variant="outline" className="text-xs font-normal">
                    {t("resourceVisibility.privateStatus")}
                  </Badge>
                ) : null}
                <Badge variant="secondary" className="text-xs font-normal">
                  {t(`organizations.resources.types.${resource.type}`)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
