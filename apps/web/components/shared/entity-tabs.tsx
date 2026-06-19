"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

interface EntityTabsProps {
  /** The entity's base path, e.g. `/${locale}/platform/macros/${id}`. */
  basePath: string;
  overviewLabel: string;
  collaboratorsLabel: string;
  children: React.ReactNode;
}

/**
 * Route-driven Overview / Collaborators tab bar for an entity detail layout
 * (macros/protocols/workbooks), mirroring the experiment layout's tabs.
 */
export function EntityTabs({
  basePath,
  overviewLabel,
  collaboratorsLabel,
  children,
}: EntityTabsProps) {
  const pathname = usePathname();
  const activeTab = pathname.includes(`${basePath}/collaborators`) ? "collaborators" : "overview";

  return (
    <NavTabs value={activeTab} className="flex w-full flex-1 flex-col">
      <NavTabsList>
        <NavTabsTrigger value="overview" asChild>
          <Link href={basePath}>{overviewLabel}</Link>
        </NavTabsTrigger>
        <NavTabsTrigger value="collaborators" asChild>
          <Link href={`${basePath}/collaborators`}>{collaboratorsLabel}</Link>
        </NavTabsTrigger>
      </NavTabsList>

      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </NavTabs>
  );
}
