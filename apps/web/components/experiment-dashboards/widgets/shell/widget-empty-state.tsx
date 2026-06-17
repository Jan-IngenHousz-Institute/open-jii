"use client";

import type { LucideIcon } from "lucide-react";

interface WidgetEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

/**
 * Shared empty-state body for widgets. Used by the read-only renderer
 * (e.g. an unpicked visualization or a rich-text widget with no content)
 * and by the editor's empty hints. Centered, muted, with a circular icon
 * badge to feel like a deliberate placeholder rather than an error.
 */
export function WidgetEmptyState({ icon: Icon, title, description }: WidgetEmptyStateProps) {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="bg-muted/40 flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <div className="text-foreground text-sm font-medium">{title}</div>
        {description && <p className="text-xs">{description}</p>}
      </div>
    </div>
  );
}
