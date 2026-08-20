"use client";

import { OrganizationMembersSurface } from "@/components/organizations/organization-members-surface";
import { use } from "react";

interface OrganizationMembersPageProps {
  params: Promise<{ id: string }>;
}

/** Members route; the layout's profile query supplies the caller's role. */
export default function OrganizationMembersPage({ params }: OrganizationMembersPageProps) {
  const { id } = use(params);

  return <OrganizationMembersSurface organizationId={id} />;
}
