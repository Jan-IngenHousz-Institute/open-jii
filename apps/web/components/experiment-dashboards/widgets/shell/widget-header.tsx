"use client";

import { cn } from "@repo/ui/lib/utils";

interface WidgetHeaderProps {
  title?: string | null;
  description?: string | null;
  className?: string;
  trailing?: React.ReactNode;
}

export function WidgetHeader({ title, description, trailing, className }: WidgetHeaderProps) {
  const hasTitle = Boolean(title && title.trim().length > 0);
  const hasDescription = Boolean(description && description.trim().length > 0);
  const hasTrailing = Boolean(trailing);

  if (!hasTitle && !hasDescription && !hasTrailing) {
    return null;
  }

  const showTitleRow = hasTitle || hasTrailing;
  const titleRowAlignment = hasTitle ? "justify-between" : "justify-end";

  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      {showTitleRow && (
        <div className={cn("flex items-baseline gap-2", titleRowAlignment)}>
          {hasTitle && (
            <h3 className="text-foreground min-w-0 truncate text-sm font-semibold">{title}</h3>
          )}
          {hasTrailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
        </div>
      )}
      {hasDescription && (
        <p className="text-muted-foreground line-clamp-2 text-xs">{description}</p>
      )}
    </div>
  );
}
