import { Button, Link, Section, Text } from "@react-email/components";

import type { EmailUnsubscribe } from "../../components/email-layout";
import { EmailLayout } from "../../components/email-layout";

export interface CalibrationRunRejectedNotificationProps {
  deviceName: string;
  definitionName: string;
  actor: string;
  calibrationUrl: string;
  senderName?: string;
  host: string;
  baseUrl: string;
  unsubscribe?: EmailUnsubscribe;
}

export const CalibrationRunRejectedNotification = ({
  deviceName,
  definitionName,
  actor,
  calibrationUrl,
  senderName = "openJII",
  host,
  baseUrl,
  unsubscribe,
}: CalibrationRunRejectedNotificationProps) => {
  return (
    <EmailLayout
      preview={`Your ${definitionName} calibration of ${deviceName} was rejected`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
      unsubscribe={unsubscribe}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          Your calibration was rejected
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          {actor} rejected the <strong>{definitionName}</strong> calibration of{" "}
          <strong>{deviceName}</strong> you ran on openJII. Nothing was applied, and the run stays
          on record.
        </Text>
        <Section className="mb-6 text-center">
          <Button
            className="rounded-lg bg-[#005E5E] px-8 py-4 font-semibold text-white no-underline"
            href={calibrationUrl}
          >
            Open calibration
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

export default CalibrationRunRejectedNotification;
