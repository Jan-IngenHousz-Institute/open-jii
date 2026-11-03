import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { formatDate } from "@/util/date";

import { cn } from "@repo/ui/lib/utils";

import { ListAuthorCell } from "./list-author-cell";
import type { OverviewTableColumn } from "./overview-table";
import { overviewTableText } from "./overview-table";

interface ListRow {
  name: string;
  updatedAt: string;
  createdByName?: string;
}

export function nameColumn<T extends ListRow>(header: string): OverviewTableColumn<T> {
  return {
    header,
    sortId: "name",
    cell: (item, href) => (
      <IntentLink
        href={href}
        title={item.name}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "focus-visible:ring-primary/40 focus-visible:outline-hidden block min-w-0 truncate text-[13px] font-semibold hover:underline focus-visible:ring-2",
          overviewTableText.strong,
        )}
      >
        {item.name}
      </IntentLink>
    ),
  };
}

export function authorColumn<T extends ListRow>(header: string): OverviewTableColumn<T> {
  return {
    header,
    className: "w-56",
    cell: (item) => <ListAuthorCell displayName={item.createdByName} />,
  };
}

export function updatedColumn<T extends ListRow>(header: string): OverviewTableColumn<T> {
  return {
    header,
    sortId: "updatedAt",
    className: "w-40",
    cell: (item) => (
      <span className={cn("text-[13px] tabular-nums", overviewTableText.muted)}>
        {formatDate(item.updatedAt)}
      </span>
    ),
  };
}
