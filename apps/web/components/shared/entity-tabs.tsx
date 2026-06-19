"use client";

import { useResourceAccess } from "@/hooks/sharing/useResourceAccess";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ResourceTypeValue } from "@repo/api/schemas/sharing.schema";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

interface EntityTabsProps {
  /** The entity's base path, e.g. `/${locale}/platform/macros/${id}`. */
  basePath: string;
  resourceType: ResourceTypeValue;
  resourceId: string;
  overviewLabel: string;
  collaboratorsLabel: string;
  children: React.ReactNode;
}

/**
 * Route-driven Overview / Collaborators tab bar for an entity detail layout
 * (macros/protocols/workbooks), mirroring the experiment layout's tabs. The
 * Collaborators tab is shown only to collaborators (not public-read viewers).
 */
export function EntityTabs({
  basePath,
  resourceType,
  resourceId,
  overviewLabel,
  collaboratorsLabel,
  children,
}: EntityTabsProps) {
  const pathname = usePathname();
  const { data: accessRes } = useResourceAccess(resourceType, resourceId);
  const isCollaborator = accessRes?.body.isCollaborator ?? false;

  const onCollaborators = pathname.includes(`${basePath}/collaborators`);
  const activeTab = onCollaborators && isCollaborator ? "collaborators" : "overview";

  return (
    <NavTabs value={activeTab} className="flex w-full flex-1 flex-col">
      <NavTabsList>
        <NavTabsTrigger value="overview" asChild>
          <Link href={basePath}>{overviewLabel}</Link>
        </NavTabsTrigger>
        {isCollaborator && (
          <NavTabsTrigger value="collaborators" asChild>
            <Link href={`${basePath}/collaborators`}>{collaboratorsLabel}</Link>
          </NavTabsTrigger>
        )}
      </NavTabsList>

      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </NavTabs>
  );
}
