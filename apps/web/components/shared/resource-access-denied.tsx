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

const UNSHAREABLE_LIST_SEGMENTS = {
  archivedExperiment: "experiments-archive",
  dashboard: "experiments",
  visualization: "experiments",
  organization: "organizations",
} as const;

export type AccessDeniedResource = SharingResourceType | keyof typeof UNSHAREABLE_LIST_SEGMENTS;

export const LIST_SEGMENTS: Record<AccessDeniedResource, string> = {
  ...RESOURCE_ROUTE_SEGMENTS,
  ...UNSHAREABLE_LIST_SEGMENTS,
};

interface ResourceAccessDeniedProps {
  resource: AccessDeniedResource;
  requestAccess?: ReactNode;
}

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
