import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  /** Omit for the bodies that carry only a one-line message. */
  title?: ReactNode;
  description?: ReactNode;
  /** Buttons or links. Laid out in a centered wrapping row. */
  children?: ReactNode;
  /**
   * Wrap in a `Card`. On by default — a page-level empty region reads as a
   * panel; the widget-level variant is `WidgetEmptyState`, not this.
   */
  card?: boolean;
  className?: string;
}

/**
 * The "nothing here yet" body used across the platform's list and detail pages.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  card = true,
  className,
}: EmptyStateProps) {
  const body = (
    <div className={cn("flex flex-col items-center justify-center py-12", !card && className)}>
      <div className="bg-muted mb-4 flex size-24 items-center justify-center rounded-full">
        <Icon className="text-muted-foreground size-12" aria-hidden />
      </div>
      {title ? <h3 className="text-foreground text-base font-medium">{title}</h3> : null}
      {description ? (
        <p className={cn("text-muted-foreground max-w-md text-center text-sm", title && "mt-1")}>
          {description}
        </p>
      ) : null}
      {children ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{children}</div>
      ) : null}
    </div>
  );

  if (!card) return body;

  return (
    <Card className={cn("shadow-none", className)}>
      <CardContent className="p-0">{body}</CardContent>
    </Card>
  );
}
