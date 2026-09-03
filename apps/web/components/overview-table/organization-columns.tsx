import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import type { OrganizationListItem } from "@/hooks/organization/useOrganizationsList/useOrganizationsList";
import { FolderOpen, Users } from "lucide-react";
import Link from "next/link";

import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { cn } from "@repo/ui/lib/utils";

import type { OverviewTableColumn } from "./overview-table";
import { overviewTableText } from "./overview-table";

export function getOrganizationColumns(
  t: (key: string, options?: Record<string, unknown>) => string,
): OverviewTableColumn<OrganizationListItem>[] {
  return [
    {
      header: t("organizations.fields.name"),
      cell: (organization, href) => (
        <>
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={href}
              title={organization.name}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "focus-visible:ring-primary/40 focus-visible:outline-hidden min-w-0 truncate text-[13px] font-semibold hover:underline focus-visible:ring-2",
                overviewTableText.strong,
              )}
            >
              {organization.name}
            </Link>
            <VisibilityBadge
              visibility={organization.visibility}
              privateOnly
              className="shrink-0"
            />
          </div>
          <div className={cn("mt-0.5 overflow-hidden text-[13px]", overviewTableText.muted)}>
            <RichTextRenderer
              content={organization.description ?? ""}
              className="whitespace-normal break-words"
              truncate
              maxLines={2}
            />
          </div>
        </>
      ),
    },
    {
      header: t("organizations.tabs.members"),
      className: "hidden w-44 sm:table-cell",
      cell: (organization) => (
        <span
          className={cn("inline-flex items-center gap-1.5 text-[13px]", overviewTableText.muted)}
        >
          <Users className="size-3.5 shrink-0" aria-hidden />
          {t("organizations.memberCount", { count: organization.memberCount })}
        </span>
      ),
    },
    {
      header: t("organizations.resources.title"),
      className: "w-56",
      cell: (organization) => {
        const label = organization.isMember
          ? t("organizations.resourceCount", { count: organization.resourceCount })
          : t("organizations.visibleResourceCount", { count: organization.resourceCount });

        return (
          <span
            title={label}
            className={cn("flex min-w-0 items-center gap-1.5 text-[13px]", overviewTableText.muted)}
          >
            <FolderOpen className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </span>
        );
      },
    },
  ];
}
