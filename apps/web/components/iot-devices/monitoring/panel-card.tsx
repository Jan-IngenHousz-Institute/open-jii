"use client";

import { SettingsCard } from "@/components/shared/settings-card";

import { cn } from "@repo/ui/lib/utils";

interface PanelCardProps {
  title: string;
  description?: string;
  /** A trailing header control, centred against the title and description. */
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

/** The dashboard's shared panel chrome. */
export function PanelCard({
  title,
  description,
  action,
  className,
  contentClassName,
  children,
}: PanelCardProps) {
  return (
    <SettingsCard
      title={title}
      description={description}
      action={action}
      className={cn(
        "min-w-0",
        action !== undefined && "[&_[data-slot=card-action]]:self-center",
        className,
      )}
      contentClassName={cn("min-w-0", contentClassName)}
    >
      {children}
    </SettingsCard>
  );
}
