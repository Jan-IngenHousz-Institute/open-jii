import { Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface ConfirmEmailOtpProps {
  otp: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const ConfirmEmailOtp = ({
  otp,
  senderName = "openJII",
  host,
  baseUrl,
}: ConfirmEmailOtpProps) => {
  return (
    <EmailLayout
      preview="Your code to confirm your email address for openJII"
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          Confirm your email address
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          Use the code below to confirm this email address for your openJII account.
        </Text>
        <Section className="mb-6 rounded-lg bg-gray-50 px-8 py-6 text-center">
          <Text className="m-0 text-center font-mono text-[36px] font-bold tracking-[0.25em] text-[#005E5E]">
            {otp}
          </Text>
        </Section>
        <Text className="mb-0 mt-0 text-center text-[14px] leading-relaxed text-gray-500">
          If you did not ask for this, you can ignore this email.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default ConfirmEmailOtp;
