import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface OrganizationInvitationProps {
  organizationName: string;
  inviteUrl: string;
  inviterName: string;
  role: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const OrganizationInvitation = ({
  organizationName,
  inviteUrl,
  inviterName,
  role,
  senderName = "openJII",
  host,
  baseUrl,
}: OrganizationInvitationProps) => {
  return (
    <EmailLayout
      preview={`${inviterName} invited you to join ${organizationName}`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          You have been invited to an organization
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          <strong>{inviterName}</strong> invited you to join <strong>{organizationName}</strong> as{" "}
          <strong>{role}</strong>.
        </Text>
        <Section className="mb-6 text-center">
          <Button
            className="rounded-lg bg-[#005E5E] px-8 py-4 font-semibold text-white no-underline"
            href={inviteUrl}
          >
            Accept invitation
          </Button>
        </Section>
        <Text className="mb-0 mt-0 text-center text-[14px] leading-relaxed text-gray-500">
          If you did not expect this invitation you can ignore this email — it expires on its own.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default OrganizationInvitation;
