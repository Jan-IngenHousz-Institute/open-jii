import { Eye } from "lucide-react";
import type { z } from "zod";

import { zVisibility } from "@repo/api/domains/visibility/visibility.schema";
import type { ListFilter } from "@repo/ui/components/list-filter-menu";

type Visibility = z.infer<typeof zVisibility>;

interface VisibilityFilterOptions {
  label: string;
  optionLabel: (value: Visibility) => string;
  selected: readonly Visibility[];
  onChange: (values: Visibility[]) => void;
}

/** The Visibility row every resource list puts in its Filter menu. */
export function visibilityFilter({
  label,
  optionLabel,
  selected,
  onChange,
}: VisibilityFilterOptions): ListFilter<Visibility> {
  return {
    key: "visibility",
    label,
    icon: Eye,
    options: zVisibility.options.map((value) => ({ value, label: optionLabel(value) })),
    selected,
    onChange,
  };
}
