import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface OrganizationRoleChangedProps {
  organizationName: string;
  organizationUrl: string;
  actor: string;
  role: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const OrganizationRoleChanged = ({
  organizationName,
  organizationUrl,
  actor,
  role,
  senderName = "openJII",
  host,
  baseUrl,
}: OrganizationRoleChangedProps) => {
  return (
    <EmailLayout
      preview={`Your role in ${organizationName} changed`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          Your role in {organizationName} changed
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          <strong>{actor}</strong> made you {role} <strong>{organizationName}</strong>.
        </Text>
        <Section className="mb-6 text-center">
          <Button
            className="rounded-lg bg-[#005E5E] px-8 py-4 font-semibold text-white no-underline"
            href={organizationUrl}
          >
            Open organization
          </Button>
        </Section>
        <Text className="mb-0 mt-0 text-center text-[14px] leading-relaxed text-gray-500">
          If you have any questions, please contact the person who changed it.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default OrganizationRoleChanged;
