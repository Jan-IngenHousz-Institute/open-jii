import { Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface OrganizationMembershipRemovedProps {
  organizationName: string;
  actor: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const OrganizationMembershipRemoved = ({
  organizationName,
  actor,
  senderName = "openJII",
  host,
  baseUrl,
}: OrganizationMembershipRemovedProps) => {
  return (
    <EmailLayout
      preview={`You were removed from ${organizationName}`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          You were removed from {organizationName}
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          <strong>{actor}</strong> removed you from <strong>{organizationName}</strong>. Shares you
          hold in your own name on its resources stay with you.
        </Text>
        <Text className="mb-0 mt-0 text-center text-[14px] leading-relaxed text-gray-500">
          If you have any questions, please contact the person who removed you.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default OrganizationMembershipRemoved;
