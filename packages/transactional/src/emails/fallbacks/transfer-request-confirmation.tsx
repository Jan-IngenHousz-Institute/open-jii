import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface TransferRequestConfirmationProps {
  projectIdOld: string;
  projectUrlOld: string;
  userEmail: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const TransferRequestConfirmation = ({
  projectIdOld,
  projectUrlOld,
  userEmail,
  senderName = "openJII",
  host,
  baseUrl,
}: TransferRequestConfirmationProps) => {
  return (
    <EmailLayout
      preview="Your transfer request has been received"
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-6 pt-8">
        {/* Title */}
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          Transfer Request Received
        </Text>

        {/* Intro */}
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          We've received your request to transfer this project. The recipient will need to accept
          the transfer before it is completed.
        </Text>

        {/* Project Info Box */}
        <Section className="mb-6 rounded-lg border border-solid border-[#005E5E] bg-gray-50 px-6 py-4">
          <Text className="mb-2 mt-0 text-[14px] font-semibold text-gray-700">Project ID:</Text>
          <Text className="mb-4 mt-0 font-mono text-[14px] text-gray-800">{projectIdOld}</Text>

          <Text className="mb-2 mt-0 text-[14px] font-semibold text-gray-700">Recipient:</Text>
          <Text className="mb-0 mt-0 font-mono text-[14px] text-gray-800">{userEmail}</Text>
        </Section>

        {/* CTA */}
        <Section className="mb-6 text-center">
          <Button
            className="rounded-lg bg-[#005E5E] px-8 py-4 font-semibold text-white no-underline"
            href={projectUrlOld}
          >
            View Project
          </Button>
        </Section>

        {/* Next Steps */}
        <Text className="mb-3 text-[18px] font-semibold text-gray-800">What happens next:</Text>
        <Text className="mb-2 text-[14px] text-gray-600">
          • The recipient will receive a transfer request.
        </Text>
        <Text className="mb-2 text-[14px] text-gray-600">
          • The transfer will complete once they accept it.
        </Text>
        <Text className="mb-6 text-[14px] text-gray-600">
          • You’ll be notified when the process is finished.
        </Text>

        {/* Warning */}
        <Text className="mb-0 text-[14px] leading-relaxed text-gray-500">
          If you did not initiate this request, please contact your administrator immediately.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default TransferRequestConfirmation;
