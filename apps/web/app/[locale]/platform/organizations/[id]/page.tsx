"use client";

import { OrganizationProfile } from "@/components/organization/organization-profile";
import { use } from "react";

interface OrganizationProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function OrganizationProfilePage({ params }: OrganizationProfilePageProps) {
  const { id } = use(params);
  return <OrganizationProfile organizationId={id} />;
}
