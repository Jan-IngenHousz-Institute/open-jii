import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  Img,
  Hr,
} from "@react-email/components";

interface OtpEmailProps {
  otp: string;
  senderName: string;
  host: string;
  baseUrl: string;
}

export const OtpEmail = ({ otp, senderName, host, baseUrl }: OtpEmailProps) => {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>Your login code is {otp}</Preview>

        <Body className="bg-[#005E5E]/15 font-sans">
          <Section className="w-full text-center">
            <Img
              src={`${baseUrl}/openJII_logo_RGB_horizontal_yellow.png`}
              alt="openJII"
              width={205}
              className="mx-auto"
            />
          </Section>

          <Container className="mx-auto w-full max-w-[780px] rounded-xl border border-solid border-[#CDD5DB] bg-white">
            <Preview>Your login code is {otp}</Preview>

            {/* Main Content */}
            <Section className="p-10">
              <Text className="mb-4 mt-0 text-[24px] font-semibold text-gray-800">
                Your login code
              </Text>
              <Text className="mb-8 text-[16px] leading-relaxed text-gray-600">
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
  baseUrl: "http://localhost:3000",
} as OtpEmailProps;
