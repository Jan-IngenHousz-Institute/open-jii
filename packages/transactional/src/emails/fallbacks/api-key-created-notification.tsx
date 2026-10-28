import { Button, Link, Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface ApiKeyCreatedNotificationProps {
  keyName: string;
  apiKeysUrl: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const ApiKeyCreatedNotification = ({
  keyName,
  apiKeysUrl,
  senderName = "openJII",
  host,
  baseUrl,
}: ApiKeyCreatedNotificationProps) => {
  return (
    <EmailLayout
      preview={`A new API key, ${keyName}, was added to your openJII account`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          A new API key was added
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          <strong>{keyName}</strong> was added to your account on openJII. If this was you, there is
          nothing to do. If it was not, open Account → API keys and remove it, then review your
          other sign-in methods.
        </Text>
        <Section className="mb-6 text-center">
          <Button
            className="rounded-lg bg-[#005E5E] px-8 py-4 font-semibold text-white no-underline"
            href={apiKeysUrl}
          >
            Open API keys
          </Button>
        </Section>
        <Text className="mb-0 mt-0 text-center text-[14px] leading-relaxed text-gray-500">
          If you believe you received this email in error, please contact{" "}
          <Link href="mailto:openjii@jii.org">openjii@jii.org</Link>.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default ApiKeyCreatedNotification;
