"use client";

import { RESOURCE_ROUTE_SEGMENTS } from "@/components/sharing/resource-routes";
import { useLocale } from "@/hooks/useLocale";
import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";

/** Denied pages exist for resources that are not shareable, so the map extends the shared one. */
const UNSHAREABLE_LIST_SEGMENTS = {
  dashboard: "experiments",
  visualization: "experiments",
  organization: "organizations",
} as const;

export type AccessDeniedResource = SharingResourceType | keyof typeof UNSHAREABLE_LIST_SEGMENTS;

/** Where each resource's own list lives, so a denied page always offers somewhere to go. */
const LIST_SEGMENTS: Record<AccessDeniedResource, string> = {
  ...RESOURCE_ROUTE_SEGMENTS,
  ...UNSHAREABLE_LIST_SEGMENTS,
};

interface ResourceAccessDeniedProps {
  resource: AccessDeniedResource;
  /**
   * The request-access affordance, when the resource accepts one. Only public
   * experiments and organizations do, so most callers leave this empty.
   */
  requestAccess?: ReactNode;
}

/**
 * What a viewer meets when they open a resource that was never shared with them,
 * which in practice means they followed a link or typed the URL: the platform
 * does not offer navigation to resources it knows are closed.
 */
export function ResourceAccessDenied({ resource, requestAccess }: ResourceAccessDeniedProps) {
  const { t } = useTranslation("common");
  const locale = useLocale();

  return (
    <EmptyState
      size="page"
      icon={<Lock aria-hidden />}
      title={t(`errors.noAccess.title.${resource}`)}
      description={t("errors.noAccess.description")}
      action={
        <div className="flex flex-col gap-3 sm:flex-row">
          {requestAccess}
          <Button asChild variant="outline">
            <Link href={`/${locale}/platform/${LIST_SEGMENTS[resource]}`}>
              {t(`errors.noAccess.back.${resource}`)}
            </Link>
          </Button>
        </div>
      }
    />
  );
}
