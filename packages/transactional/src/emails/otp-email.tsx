import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";
import * as React from "react";

interface OtpEmailProps {
  otp: string;
  senderName: string;
  host: string;
}

export const OtpEmail = ({ otp, senderName, host }: OtpEmailProps) => {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Body className="mx-auto my-auto bg-gray-50 font-sans" style={{ color: "#374151" }}>
          <Container className="mx-auto my-[40px] w-[580px] rounded-lg border border-solid border-gray-200 bg-white shadow-sm">
            <Preview>Your openJII login code</Preview>

            {/* Header */}
            <Section className="rounded-t-lg bg-[#005e5e] px-8 py-6">
              <Text className="m-0 text-center text-[28px] font-bold text-white">{senderName}</Text>
            </Section>

            {/* Main Content */}
            <Section className="px-8 py-8">
              <Text className="mb-4 mt-0 text-center text-[24px] font-semibold text-gray-800">
                Your login code
              </Text>
              <Text className="mb-8 text-center text-[16px] leading-relaxed text-gray-600">
                Enter the following code to sign in to your openJII account. This code will expire
                in 5 minutes.
              </Text>
              <Section className="my-[32px] rounded border border-solid border-gray-200 bg-gray-50 p-[24px] text-center">
                <Text className="m-0 text-[32px] font-bold tracking-widest text-gray-900">
                  {otp}
                </Text>
              </Section>
              <Hr className="my-6 border-gray-200" />
              <Text className="mb-0 mt-6 text-[14px] leading-relaxed text-gray-500">
                If you didn't request this code, you can safely ignore this email. Your account
                remains secure.
              </Text>
            </Section>

            {/* Footer */}
            <Section className="rounded-b-lg border-t border-gray-100 bg-gray-50 px-8 py-4">
              <Text className="m-0 text-center text-[12px] text-gray-400">
                This email was sent by {senderName} • {host}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default OtpEmail;

OtpEmail.PreviewProps = {
  otp: "123456",
  senderName: "openJII",
  host: "localhost",
} as OtpEmailProps;
