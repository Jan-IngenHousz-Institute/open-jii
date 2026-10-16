"use client";

import {
  GROUP_ORDER,
  RESOURCE_TYPE_COLOR,
} from "@/components/organizations/organization-resource-meta";

import type { VisitedResourceType } from "@repo/api/domains/visit/visit.schema";
import { useTranslation } from "@repo/i18n";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import { cn } from "@repo/ui/lib/utils";

export const ALL_TYPES = "all";

interface RecentlyOpenedChipsProps {
  types: VisitedResourceType[];
  value: VisitedResourceType | null;
  onChange: (value: string) => void;
}

const chipClassName =
  "data-[state=on]:border-primary h-8 shrink-0 rounded-full px-3 font-normal data-[state=on]:font-medium";

/** All, then one chip per type the reader has opened, in the organization page's type order. */
export function RecentlyOpenedChips({ types, value, onChange }: RecentlyOpenedChipsProps) {
  const { t } = useTranslation();
  const ordered = GROUP_ORDER.filter((type) => types.some((visited) => visited === type));

  const renderChip = (type: (typeof ordered)[number]) => (
    <ToggleGroupItem key={type} value={type} className={chipClassName}>
      <span className={cn("size-2 rounded-full", RESOURCE_TYPE_COLOR[type])} aria-hidden />
      {t(`organizations.resources.types.${type}`, { count: 2 })}
    </ToggleGroupItem>
  );

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value ?? ALL_TYPES}
      onValueChange={onChange}
      aria-label={t("dashboard.typeFilterLabel")}
      className="-mx-1 justify-start gap-2 overflow-x-auto px-1 py-0.5"
    >
      <ToggleGroupItem value={ALL_TYPES} className={chipClassName}>
        {t("dashboard.allTypes")}
      </ToggleGroupItem>
      {ordered.map(renderChip)}
    </ToggleGroup>
  );
}
