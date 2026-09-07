"use client";

import { SettingsCard } from "@/components/shared/settings-card";

import { cn } from "@repo/ui/lib/utils";

interface PanelCardProps {
  title: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

/** The dashboard's shared panel chrome. */
export function PanelCard({
  title,
  description,
  className,
  contentClassName,
  children,
}: PanelCardProps) {
  return (
    <SettingsCard
      title={title}
      description={description}
      className={cn("min-w-0", className)}
      contentClassName={cn("min-w-0", contentClassName)}
    >
      {children}
    </SettingsCard>
  );
}
