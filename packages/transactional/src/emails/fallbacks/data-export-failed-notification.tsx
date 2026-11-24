import { Button, Link, Section, Text } from "@react-email/components";

import type { EmailUnsubscribe } from "../../components/email-layout";
import { EmailLayout } from "../../components/email-layout";

export interface DataExportFailedNotificationProps {
  experimentName: string;
  dataUrl: string;
  senderName?: string;
  host: string;
  baseUrl: string;
  unsubscribe?: EmailUnsubscribe;
}

export const DataExportFailedNotification = ({
  experimentName,
  dataUrl,
  senderName = "openJII",
  host,
  baseUrl,
  unsubscribe,
}: DataExportFailedNotificationProps) => {
  return (
    <EmailLayout
      preview={`Your export of ${experimentName} failed`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
      unsubscribe={unsubscribe}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          Your export failed
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          Your export of <strong>{experimentName}</strong> on openJII did not complete. The
          dataset's export list on the experiment's Data tab says why, and you can start the export
          again from there.
        </Text>
        <Section className="mb-6 text-center">
          <Button
            className="rounded-lg bg-[#005E5E] px-8 py-4 font-semibold text-white no-underline"
            href={dataUrl}
          >
            Open Data tab
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

export default DataExportFailedNotification;
