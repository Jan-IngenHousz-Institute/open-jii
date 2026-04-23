import { Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface OtpEmailProps {
  otp: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const OtpEmail = ({ otp, senderName = "openJII", host, baseUrl }: OtpEmailProps) => {
  return (
    <EmailLayout
      preview="Your sign-in code for openJII"
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          Your one-time sign-in code
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          Use the code below to sign in to your account. It expires shortly.
        </Text>
        <Section className="mb-6 rounded-lg bg-gray-50 px-8 py-6 text-center">
          <Text className="m-0 text-center font-mono text-[36px] font-bold tracking-[0.25em] text-[#005E5E]">
            {otp}
          </Text>
        </Section>
        <Text className="mb-0 mt-0 text-center text-[14px] leading-relaxed text-gray-500">
          If you didn&apos;t request this code, you can safely ignore this email. Your account
          remains secure.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default OtpEmail;
