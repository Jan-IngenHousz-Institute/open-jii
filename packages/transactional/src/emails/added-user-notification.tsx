import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  Hr,
  Img,
} from "@react-email/components";

interface AddedUserNotificationProps {
  host: string;
  experimentName: string;
  experimentUrl: string;
  actor: string;
  role: string;
  senderName?: string;
  baseUrl: string;
}

export const AddedUserNotification = ({
  host,
  experimentName,
  experimentUrl,
  actor,
  role,
  senderName = "openJII",
  baseUrl,
}: AddedUserNotificationProps) => {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>You've been added to an openJII experiment</Preview>

        <Body className="bg-[#005E5E]/15 font-sans">
          {/* Logo (same as OTP) */}
          <Section className="w-full text-center">
            <Img
              src={`${baseUrl}/openJII_logo_RGB_horizontal_yellow.png`}
              alt="openJII"
              width={205}
              className="mx-auto"
            />
          </Section>

          {/* Main Container (same as OTP) */}
          <Container className="mx-auto w-full max-w-[780px] rounded-xl border border-solid border-[#CDD5DB] bg-white">
            <Section className="p-10">
              <Text className="mb-6 mt-0 text-[24px] font-semibold text-gray-800">
                Welcome to the team!
              </Text>

              <Text className="mb-4 text-[16px] leading-relaxed text-gray-600">
                <strong>{actor}</strong> has added you as a <strong>{role}</strong> to the
                experiment <strong>"{experimentName}"</strong>.
              </Text>
              <Text className="mb-8 text-[16px] leading-relaxed text-gray-600">
                You can now access the experiment dashboard, collaborate with the team, and
                contribute to this research project.
              </Text>
              <Section className="mb-8 text-center">
                <Button
                  className="rounded-lg bg-[#005e5e] px-8 py-4 font-semibold text-white no-underline shadow-md transition-colors hover:bg-[#004747]"
                  href={experimentUrl}
                >
                  Access experiment
                </Button>
              </Section>
              <Hr className="my-6 border-gray-200" />
              <Text className="mb-3 text-[14px] leading-relaxed text-gray-500">
                <strong>Having trouble?</strong> If the button above doesn't work, copy and paste
                this link into your browser:
              </Text>
              <Text className="break-all rounded border bg-gray-50 p-3 font-mono text-[14px]">
                <Link href={experimentUrl} className="text-[#005e5e] no-underline hover:underline">
                  {experimentUrl}
                </Link>
              </Text>
              <Text className="mb-0 mt-6 text-[14px] leading-relaxed text-gray-500">
                If you believe you received this email in error, please contact{" "}
                <Link href="mailto:openjii@jii.org" className="text-[#005e5e] underline">
                  openjii@jii.org
                </Link>
                .
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

export default AddedUserNotification;

AddedUserNotification.PreviewProps = {
  host: "localhost",
  experimentName: "My Experiment",
  experimentUrl: "http://localhost:3000/en-US/platform/experiments/123",
  actor: "Jane Doe",
  role: "member",
  senderName: "openJII",
  baseUrl: "http://localhost:3000",
} as AddedUserNotificationProps;
