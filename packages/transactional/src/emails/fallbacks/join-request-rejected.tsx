import { Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface JoinRequestRejectedProps {
  experimentName: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const JoinRequestRejected = ({
  experimentName,
  senderName = "openJII",
  host,
  baseUrl,
}: JoinRequestRejectedProps) => {
  return (
    <EmailLayout
      preview={`Update on your request to join ${experimentName}`}
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          Update on your join request
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          Your request to join <strong>{experimentName}</strong> was not accepted at this time.
        </Text>
        <Text className="mb-0 mt-0 text-center text-[14px] leading-relaxed text-gray-500">
          You can continue to explore other public projects on openJII.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default JoinRequestRejected;
