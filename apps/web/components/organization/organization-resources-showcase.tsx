"use client";

import { useOrganizationResources } from "@/hooks/organization/useOrganizationResources";
import { useLocale } from "@/hooks/useLocale";
import { Beaker, Cpu, FileCode, FlaskConical, NotebookPen, Sparkles } from "lucide-react";
import Link from "next/link";

import type { OrganizationResources } from "@repo/api/schemas/organization.schema";
import { Skeleton } from "@repo/ui/components/skeleton";

interface OrganizationResourcesShowcaseProps {
  organizationId: string;
  /** Members also see the org's private resources, so the framing differs. */
  isMember?: boolean;
}

type Group = keyof OrganizationResources;

const GROUPS: { key: Group; label: string; icon: typeof Beaker; route?: string }[] = [
  { key: "experiments", label: "Experiments", icon: FlaskConical, route: "experiments" },
  { key: "protocols", label: "Protocols", icon: FileCode, route: "protocols" },
  { key: "macros", label: "Macros", icon: Beaker, route: "macros" },
  { key: "workbooks", label: "Workbooks", icon: NotebookPen, route: "workbooks" },
  { key: "devices", label: "Devices", icon: Cpu },
];

/**
 * The org's recent activity, grouped by resource type. Members see public and
 * private resources; non-members see only public ones.
 */
export function OrganizationResourcesShowcase({
  organizationId,
  isMember = false,
}: OrganizationResourcesShowcaseProps) {
  const locale = useLocale();
  const { data, isPending } = useOrganizationResources(organizationId);
  const resources = data?.body;

  if (isPending) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!resources) return null;

  const total = GROUPS.reduce((sum, g) => sum + resources[g.key].length, 0);
  if (total === 0) {
    return (
      <div className="rounded-lg border px-6 py-10 text-center">
        <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="text-foreground text-sm font-semibold">No recent activity</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {isMember
            ? "This organization has no resources yet."
            : "This organization has not shared any public resources."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Recent activity</h2>
      {GROUPS.map((group) => {
        const items = resources[group.key];
        if (items.length === 0) return null;
        return (
          <section key={group.key} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <group.icon className="text-muted-foreground h-4 w-4" />
              {group.label}
              <span className="text-muted-foreground font-normal">({items.length})</span>
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((item) => {
                const content = (
                  <div className="hover:bg-muted/50 rounded-md border p-3 transition-colors">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-muted-foreground line-clamp-2 text-xs">
                        {item.description}
                      </p>
                    )}
                  </div>
                );
                return group.route ? (
                  <Link key={item.id} href={`/${locale}/platform/${group.route}/${item.id}`}>
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
