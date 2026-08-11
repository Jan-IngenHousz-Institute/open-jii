"use client";

import { AcceptOrganizationInvitation } from "@/components/organizations/accept-organization-invitation";
import { use } from "react";

interface AcceptInvitationPageProps {
  params: Promise<{ id: string }>;
}

export default function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
  const { id } = use(params);

  return <AcceptOrganizationInvitation invitationId={id} />;
}
