import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface OrganizationJoinRequestSubmittedProps {
  organizationName: string;
  organizationUrl: string;
  requesterName: string;
  message?: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const OrganizationJoinRequestSubmitted = ({
  organizationName,
  organizationUrl,
  requesterName,
  message,
  senderName = "openJII",
  host,
  baseUrl,
}: OrganizationJoinRequestSubmittedProps) => {
  return (
    <EmailLayout
      preview={`${requesterName} requested to join ${organizationName}`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          New request to join your organization
        </Text>
        <Text className="mb-4 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          <strong>{requesterName}</strong> has requested to join <strong>{organizationName}</strong>
          .
        </Text>
        {message ? (
          <Section className="mb-6 rounded-lg bg-gray-50 px-6 py-4">
            <Text className="mb-1 mt-0 text-[13px] font-medium uppercase tracking-wide text-gray-500">
              Message from the requester
            </Text>
            <Text className="mb-0 mt-0 text-[15px] leading-relaxed text-gray-700">{message}</Text>
          </Section>
        ) : null}
        <Section className="mb-6 text-center">
          <Button
            className="rounded-lg bg-[#005E5E] px-8 py-4 font-semibold text-white no-underline"
            href={organizationUrl}
          >
            Review request
          </Button>
        </Section>
        <Text className="mb-0 mt-0 text-center text-[14px] leading-relaxed text-gray-500">
          Open the organization to approve or reject this request.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default OrganizationJoinRequestSubmitted;
