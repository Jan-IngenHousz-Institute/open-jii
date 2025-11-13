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
} from "@react-email/components";

interface AddedUserNotificationProps {
  host: string;
  experimentName: string;
  experimentUrl: string;
  actor: string;
  role: string;
}

export const AddedUserNotification = ({
  host,
  experimentName,
  experimentUrl,
  actor,
  role,
}: AddedUserNotificationProps) => {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Body className="mx-auto my-auto bg-gray-50 font-sans" style={{ color: "#374151" }}>
          <Container className="mx-auto my-[40px] w-[580px] rounded-lg border border-solid border-gray-200 bg-white shadow-sm">
            <Preview>Invitation to openJII experiment</Preview>

            {/* Header */}
            <Section className="rounded-t-lg bg-[#005e5e] px-8 py-6">
              <Text className="m-0 text-center text-[28px] font-bold text-white">openJII</Text>
            </Section>

            {/* Main Content */}
            <Section className="px-8 py-8">
              <Text className="mb-4 mt-0 text-center text-[24px] font-semibold text-gray-800">
                You have been added by {actor} as a {role} to the experiment {experimentName}.
              </Text>
              <Text className="mb-8 text-center text-[16px] leading-relaxed text-gray-600">
                Click the button below to go to the experiment.
              </Text>
              <Section className="mb-8 text-center">
                <Button
                  className="rounded-lg bg-[#005e5e] px-8 py-4 font-semibold text-white no-underline shadow-md transition-colors hover:bg-[#004747]"
                  href={experimentUrl}
                >
                  Go To Experiment
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
                If you didn't request this verification, you can safely ignore this email. Your
                account remains secure.
              </Text>
            </Section>

            {/* Footer */}
            <Section className="rounded-b-lg border-t border-gray-100 bg-gray-50 px-8 py-4">
              <Text className="m-0 text-center text-[12px] text-gray-400">
                This email was sent by openJII • {host}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
