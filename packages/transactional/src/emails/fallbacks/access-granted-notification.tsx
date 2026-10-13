import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface AccessGrantedNotificationProps {
  resourceKind: string;
  resourceName: string;
  resourceUrl: string;
  actor: string;
  role: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const AccessGrantedNotification = ({
  resourceKind,
  resourceName,
  resourceUrl,
  actor,
  role,
  senderName = "openJII",
  host,
  baseUrl,
}: AccessGrantedNotificationProps) => {
  return (
    <EmailLayout
      preview={`You now have access to ${resourceName} on openJII`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          You now have access to {resourceName}
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          <strong>{actor}</strong> has given you access to the {resourceKind}{" "}
          <strong>{resourceName}</strong> as <strong>{role}</strong>.
        </Text>
        <Section className="mb-6 text-center">
          <Button
            className="rounded-lg bg-[#005E5E] px-8 py-4 font-semibold text-white no-underline"
            href={resourceUrl}
          >
            Open {resourceKind}
          </Button>
        </Section>
        <Text className="mb-0 mt-0 text-center text-[14px] leading-relaxed text-gray-500">
          If you have any questions, please contact the person who gave you access.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default AccessGrantedNotification;
