"use client";

import { OrganizationSettingsSurface } from "@/components/organizations/organization-settings-surface";
import { use } from "react";

interface OrganizationSettingsPageProps {
  params: Promise<{ id: string }>;
}

/** Owner-only settings; the layout's profile query supplies the caller's role. */
export default function OrganizationSettingsPage({ params }: OrganizationSettingsPageProps) {
  const { id } = use(params);

  return <OrganizationSettingsSurface organizationId={id} />;
}
