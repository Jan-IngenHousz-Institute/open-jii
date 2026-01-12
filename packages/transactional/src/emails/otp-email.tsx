import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";
import * as React from "react";

interface OtpEmailProps {
  otp: string;
  baseUrl: string;
}

export const OtpEmail = ({ otp, baseUrl }: OtpEmailProps) => {
  const previewText = `Your openJII login code`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans text-gray-900 antialiased">
          <Container className="mx-auto my-[40px] max-w-lg p-[20px]">
            <Section className="mt-[32px]">
              <Img
                src={`${baseUrl}/static/logo.png`}
                width="140"
                height="32"
                alt="OpenJII"
                className="my-0"
              />
            </Section>
            <Heading className="mx-0 my-[30px] p-0 text-[24px] font-normal text-gray-900">
              Your login code
            </Heading>
            <Text className="text-[14px] leading-[24px] text-gray-900">
              Enter the following code to sign in to openJII. This code will expire in 5 minutes.
            </Text>
            <Section className="my-[32px] rounded border border-solid border-gray-200 bg-gray-50 p-[24px] text-center">
              <Text className="m-0 text-[32px] font-bold tracking-widest text-gray-900">{otp}</Text>
            </Section>
            <Text className="text-[14px] leading-[24px] text-gray-500">
              If you didn't request this email, you can safely ignore it.
            </Text>
            <Hr className="mx-0 my-[26px] w-full border border-solid border-gray-200" />
            <Text className="pl-1 text-[12px] leading-[24px] text-gray-500">JII Open Platform</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default OtpEmail;

OtpEmail.PreviewProps = {
  otp: "123456",
  baseUrl: "http://localhost:3000",
} as OtpEmailProps;
