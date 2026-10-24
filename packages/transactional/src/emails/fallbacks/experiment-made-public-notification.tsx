import { Button, Link, Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface ExperimentMadePublicNotificationProps {
  experimentName: string;
  experimentUrl: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const ExperimentMadePublicNotification = ({
  experimentName,
  experimentUrl,
  senderName = "openJII",
  host,
  baseUrl,
}: ExperimentMadePublicNotificationProps) => {
  return (
    <EmailLayout
      preview={`${experimentName} is now public on openJII`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          {experimentName} is now public
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          The embargo on the experiment <strong>{experimentName}</strong> ended, and it is now
          public on openJII, so anyone can see it.
        </Text>
        <Section className="mb-6 text-center">
          <Button
            className="rounded-lg bg-[#005E5E] px-8 py-4 font-semibold text-white no-underline"
            href={experimentUrl}
          >
            Open experiment
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

export default ExperimentMadePublicNotification;
