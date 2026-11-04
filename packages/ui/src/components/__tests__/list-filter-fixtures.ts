import { CircleDashed, Eye } from "lucide-react";
import { vi } from "vitest";

import type { ListFilter, ListFilterLabels } from "../list-filter-menu";

export const labels: ListFilterLabels = {
  filter: "Filter",
  addFilter: "Add filter",
  is: "is",
  chip: (filter, value) => `${filter} is ${value}`,
  back: "Back",
  clearFilters: "Clear filters",
  selectedCount: (count) => `${count} selected`,
  removeValue: (filter, value) => `Remove ${filter} is ${value}`,
};

type Status = "draft" | "active" | "published";
type Visibility = "private" | "public";

/** A Status and a Visibility filter with spies for their changes. */
export function makeFilters({
  statuses = [],
  visibilities = [],
}: { statuses?: Status[]; visibilities?: Visibility[] } = {}) {
  const onStatuses = vi.fn<(values: Status[]) => void>();
  const onVisibilities = vi.fn<(values: Visibility[]) => void>();
  const filters: ListFilter[] = [
    {
      key: "status",
      label: "Status",
      icon: CircleDashed,
      options: [
        { value: "draft", label: "Draft" },
        { value: "active", label: "Active" },
        { value: "published", label: "Published" },
      ],
      selected: statuses,
      onChange: onStatuses,
    },
    {
      key: "visibility",
      label: "Visibility",
      icon: Eye,
      options: [
        { value: "private", label: "Private" },
        { value: "public", label: "Public" },
      ],
      selected: visibilities,
      onChange: onVisibilities,
    },
  ];
  return { filters, onStatuses, onVisibilities };
}
