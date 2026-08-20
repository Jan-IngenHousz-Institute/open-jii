"use client";

import { OrganizationOverview } from "@/components/organizations/organization-overview";
import { use } from "react";

interface OrganizationOverviewPageProps {
  params: Promise<{ id: string }>;
}

/** The organization's public face; the layout's profile query supplies the card. */
export default function OrganizationOverviewPage({ params }: OrganizationOverviewPageProps) {
  const { id } = use(params);

  return <OrganizationOverview organizationId={id} />;
}
