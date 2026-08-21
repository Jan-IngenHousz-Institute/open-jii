import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Trailing controls. Right-aligned from `md` up, stacked under the title below it. */
  actions?: ReactNode;
  /**
   * `page` is a route index; `section` is a tab or panel inside an entity. Two
   * scales, because a nested tab title competing with the entity's own name
   * reads as two page titles.
   */
  level?: "page" | "section";
  /** Extra content under the description — a docs link, an archive link. */
  children?: ReactNode;
  className?: string;
}

/**
 * Title / description / actions row shared by the platform's pages.
 */
export function PageHeader({
  title,
  description,
  actions,
  level = "page",
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-2 md:flex-row md:items-start md:justify-between", className)}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            "text-foreground font-bold",
            level === "page" ? "text-4xl" : "text-2xl tracking-tight",
          )}
        >
          {title}
        </h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 gap-4">{actions}</div> : null}
    </div>
  );
}
