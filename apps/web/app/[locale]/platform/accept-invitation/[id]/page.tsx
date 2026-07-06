import { PageContainer } from "@/components/page-container";
import { use } from "react";
import { AcceptInvitation } from "~/components/organization/accept-invitation";

interface AcceptInvitationPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
  const { id, locale } = use(params);

  return (
    <PageContainer width="reading" className="space-y-6">
      <AcceptInvitation invitationId={id} locale={locale} />
    </PageContainer>
  );
}
