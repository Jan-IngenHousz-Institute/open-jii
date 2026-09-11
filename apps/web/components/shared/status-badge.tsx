import type { ReactNode } from "react";

import { Badge } from "@repo/ui/components/badge";
import { cn, cva } from "@repo/ui/lib/utils";

/**
 * The distinct hues a status or category pill can wear. These are the only
 * colours in the app that live outside the shadcn contract — see the
 * `--status-*` block in `app/globals.css` — so they swap with the theme like
 * everything else, and there are deliberately five of them rather than one per
 * domain value. Callers map their own vocabulary onto a tone.
 */
export type StatusTone = "active" | "stale" | "archived" | "published" | "featured" | "destructive";

const statusBadgeVariants = cva("border-transparent font-medium", {
  variants: {
    tone: {
      active: "bg-status-active text-status-active-foreground",
      stale: "bg-status-stale text-status-stale-foreground",
      archived: "bg-status-archived text-status-archived-foreground",
      published: "bg-status-published text-status-published-foreground",
      featured: "bg-status-featured text-status-featured-foreground",
      // The one tone that is not a pale fill: a failed state should read as an
      // error, and the contract already has that colour.
      destructive: "bg-destructive text-destructive-foreground",
    },
  },
});

export interface StatusBadgeProps {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}

/**
 * A status or category pill. Fill and foreground travel together here rather
 * than as a colour class handed to `Badge`, which is what let them drift apart.
 */
export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return <Badge className={cn(statusBadgeVariants({ tone }), className)}>{children}</Badge>;
}
