import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import type { ReactNode } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

export interface SettingsCardProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "title" | "className"> {
  title: ReactNode;
  /**
   * `destructive` marks a section whose actions cannot be undone. It exists
   * because a delete-my-account panel that reads exactly like a newsletter
   * panel has lost a safety affordance, not a decoration — so the treatment
   * lives here, once, rather than as classes at the one call site that wants
   * it. `Card` itself stays registry-stock.
   */
  tone?: "default" | "destructive";
  description?: ReactNode;
  /** Shown beside the title. */
  icon?: LucideIcon;
  /** A trailing header control — a create button, a menu. */
  action?: ReactNode;
  /** Extra header content under the description, e.g. a docs link. */
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * A titled settings section. Every one of these was a `Card` with its own
 * header spacing, so the same section read at a different rhythm depending on
 * which page it was on.
 */
export function SettingsCard({
  title,
  tone = "default",
  description,
  icon: Icon,
  action,
  headerExtra,
  children,
  className,
  contentClassName,
  ...rest
}: SettingsCardProps) {
  return (
    <Card className={cn(tone === "destructive" && "border-destructive/30", className)} {...rest}>
      <CardHeader>
        <CardTitle
          className={cn(
            Icon && "flex items-center gap-2",
            tone === "destructive" && "text-destructive",
          )}
        >
          {Icon ? <Icon className="text-primary size-5" aria-hidden /> : null}
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {headerExtra}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
