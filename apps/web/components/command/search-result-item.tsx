"use client";

import { organizationTypeLabelKey } from "@/components/organizations/organization-labels";
import { stripHtml } from "@/util/strip-html";
import { BookOpen, Building2, Code, FileSliders, Leaf } from "lucide-react";
import * as React from "react";

import { zOrganizationType } from "@repo/api/domains/organization/organization.schema";
import type { SearchResult, SearchResultType } from "@repo/api/domains/search/search.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { CommandItem } from "@repo/ui/components/command";

const ICONS: Record<SearchResultType, React.ComponentType<{ className?: string }>> = {
  experiment: Leaf,
  protocol: FileSliders,
  macro: Code,
  workbook: BookOpen,
  organization: Building2,
};

const LANGUAGE_LABELS: Record<string, string> = {
  python: "Python",
  r: "R",
  javascript: "JavaScript",
};

/**
 * Human-readable form of the type-specific `meta` label (macro language, protocol family,
 * organization type). Organization types are the one kind that is translated: they have real
 * labels ("Research institute") rather than the single-word identifier the others carry, and
 * the key map already exists for the pickers and the profile header.
 */
function metaLabel(type: SearchResultType, meta: string, t: (key: string) => string): string {
  if (type === "macro") return LANGUAGE_LABELS[meta] ?? meta;
  if (type === "organization") {
    const parsed = zOrganizationType.safeParse(meta);
    // An unrecognised spelling renders as stored rather than as a missing-key placeholder.
    return parsed.success ? t(organizationTypeLabelKey(parsed.data)) : meta;
  }
  // Protocol family and any other label: capitalize the first letter.
  return meta.charAt(0).toUpperCase() + meta.slice(1);
}

export function SearchResultItem({
  result,
  onSelect,
}: {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
}) {
  const { t } = useTranslation();
  const Icon = ICONS[result.type];
  // Descriptions can contain rich-text markup (experiments), so strip tags for a clean one-liner.
  const subtitle = result.subtitle ? stripHtml(result.subtitle) : "";
  return (
    <CommandItem
      // Stable, unique value so cmdk keyboard navigation works with filtering disabled.
      value={`${result.type}:${result.id}`}
      onSelect={() => onSelect(result)}
    >
      <Icon className="mr-2 h-4 w-4 shrink-0" />
      <div className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm">{result.title}</span>
          {result.meta && (
            <Badge
              variant="outline"
              className="text-muted-foreground shrink-0 px-1.5 py-0 text-[10px] font-medium"
            >
              {metaLabel(result.type, result.meta, t)}
            </Badge>
          )}
        </span>
        {subtitle && <span className="text-muted-foreground truncate text-xs">{subtitle}</span>}
      </div>
    </CommandItem>
  );
}
