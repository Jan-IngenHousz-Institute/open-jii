import type { ListFilters, ListFilterShape } from "@/hooks/useListUrlState";
import type { z } from "zod";

import type { ListFilter } from "@repo/ui/components/list-filter-menu";

interface FilterableList<S extends ListFilterShape> {
  filterShape: S;
  filters: ListFilters<S>;
  setFilter<K extends keyof S>(key: K, values: z.infer<S[K]>[]): void;
}

interface ResourceListFilterOptions<Value extends string> {
  label: string;
  icon: ListFilter["icon"];
  optionLabel: (value: Value) => string;
}

/** One row of the Filter menu for a list's URL filter, offering every value its schema allows. */
export function resourceListFilter<S extends ListFilterShape, K extends keyof S & string>(
  list: FilterableList<S>,
  key: K,
  { label, icon, optionLabel }: ResourceListFilterOptions<z.infer<S[K]>>,
): ListFilter<z.infer<S[K]>> {
  const values = list.filterShape[key].options as z.infer<S[K]>[];
  return {
    key,
    label,
    icon,
    options: values.map((value) => ({ value, label: optionLabel(value) })),
    selected: list.filters[key],
    onChange: (picked) => list.setFilter(key, picked),
  };
}
