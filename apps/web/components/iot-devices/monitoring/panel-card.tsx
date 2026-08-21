"use client";

import { SettingsCard } from "@/components/shared/settings-card";

interface PanelCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/** The dashboard's shared panel chrome. */
export function PanelCard({ title, description, children }: PanelCardProps) {
  return (
    <SettingsCard title={title} description={description}>
      {children}
    </SettingsCard>
  );
}
