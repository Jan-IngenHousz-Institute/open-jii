import { Button, Link, Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface DataUploadFailedNotificationProps {
  experimentName: string;
  tableName: string;
  dataUrl: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const DataUploadFailedNotification = ({
  experimentName,
  tableName,
  dataUrl,
  senderName = "openJII",
  host,
  baseUrl,
}: DataUploadFailedNotificationProps) => {
  return (
    <EmailLayout
      preview={`Your upload to ${tableName} in ${experimentName} failed`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          Your upload failed
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          Your upload to the table <strong>{tableName}</strong> in <strong>{experimentName}</strong>{" "}
          on openJII did not complete. The upload history on the experiment's Data tab says why, and
          lists any files that were left out, so you can fix them and upload again.
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

export default DataUploadFailedNotification;
