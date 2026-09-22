import type { ReactNode } from "react";

import { cn, cva } from "@repo/ui/lib/utils";

/**
 * A recessed panel — the counterpart to `Card`, which is a raised surface.
 *
 * The distinction is real and the reason this is not a `Card`: a card sits
 * above the page, a well sits below it. The app had two dozen hand-rolled
 * versions of this shape that had drifted apart on fill (`bg-muted`,
 * `bg-muted/20`, `bg-muted/30`), radius and padding with no rule behind which
 * site got which. The values here are the majority reading of that set, and
 * density is a named step rather than a free-form class so the drift cannot
 * come back.
 */
const insetPanelVariants = cva("rounded-md border", {
  variants: {
    tone: {
      default: "bg-muted/30",
      // Matches `SettingsCard`'s destructive tone, so a danger-zone card and
      // the blockers nested inside it read as one region.
      destructive: "bg-muted/30 border-destructive/30",
    },
    padding: {
      none: "",
      sm: "p-2.5",
      md: "p-3",
      lg: "p-4",
    },
    /** A placeholder or drop target rather than a filled panel. */
    dashed: {
      true: "border-dashed",
      false: "",
    },
  },
  defaultVariants: { tone: "default", padding: "md", dashed: false },
});

export interface InsetPanelProps {
  tone?: "default" | "destructive";
  padding?: "none" | "sm" | "md" | "lg";
  dashed?: boolean;
  children?: ReactNode;
  className?: string;
}

export function InsetPanel({
  tone = "default",
  padding = "md",
  dashed = false,
  children,
  className,
}: InsetPanelProps) {
  return (
    <div className={cn(insetPanelVariants({ tone, padding, dashed }), className)}>{children}</div>
  );
}
