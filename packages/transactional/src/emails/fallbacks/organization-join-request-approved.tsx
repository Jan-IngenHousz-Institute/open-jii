import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface OrganizationJoinRequestApprovedProps {
  organizationName: string;
  organizationUrl: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const OrganizationJoinRequestApproved = ({
  organizationName,
  organizationUrl,
  senderName = "openJII",
  host,
  baseUrl,
}: OrganizationJoinRequestApprovedProps) => {
  return (
    <EmailLayout
      preview={`You are now a member of ${organizationName}`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          Your join request was approved
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          You are now a member of <strong>{organizationName}</strong>.
        </Text>
        <Section className="mb-6 text-center">
          <Button
            className="rounded-lg bg-[#005E5E] px-8 py-4 font-semibold text-white no-underline"
            href={organizationUrl}
          >
            Open organization
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
};

export default OrganizationJoinRequestApproved;
