"use client";

import { SettingsCard } from "@/components/shared/settings-card";

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
      className={className}
      contentClassName={contentClassName}
    >
      {children}
    </SettingsCard>
  );
}
