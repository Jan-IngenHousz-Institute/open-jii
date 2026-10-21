import { Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface ResourceDeletedNotificationProps {
  resourceKind: string;
  resourceName: string;
  actor: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const ResourceDeletedNotification = ({
  resourceKind,
  resourceName,
  actor,
  senderName = "openJII",
  host,
  baseUrl,
}: ResourceDeletedNotificationProps) => {
  return (
    <EmailLayout
      preview={`${resourceName} was deleted on openJII`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          {resourceName} was deleted
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          <strong>{actor}</strong> deleted the {resourceKind} <strong>{resourceName}</strong>. It is
          no longer available on openJII.
        </Text>
        <Text className="mb-0 mt-0 text-center text-[14px] leading-relaxed text-gray-500">
          If you have any questions, please contact the person who deleted it.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default ResourceDeletedNotification;
