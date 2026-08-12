import type { LucideIcon } from "lucide-react";

import { Card } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

interface OrganizationStatTileProps {
  label: string;
  value: number;
  icon: LucideIcon;
  className?: string;
}

/**
 * One number about the organization, on the shared `Card` — there is no `StatTile`
 * in `@repo/ui` and one tile shape used on one surface does not earn a place there.
 *
 * The number reads first and the label second, which is the opposite of the DOM
 * order that makes sense to a screen reader; hence a single accessible string on the
 * tile and the two halves hidden from it.
 */
export function OrganizationStatTile({
  label,
  value,
  icon: Icon,
  className,
}: OrganizationStatTileProps) {
  return (
    <Card
      className={cn("flex items-center gap-3 p-4", className)}
      aria-label={`${label}: ${value}`}
    >
      {/* Teal like the organization's mark: these state what it has, which is the
          same brand-positive register. Empty states stay grey — see below. */}
      <div className="bg-quaternary text-primary grid h-9 w-9 shrink-0 place-items-center rounded-md">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0" aria-hidden>
        <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
        <p className="text-muted-foreground mt-1 truncate text-xs">{label}</p>
      </div>
    </Card>
  );
}
