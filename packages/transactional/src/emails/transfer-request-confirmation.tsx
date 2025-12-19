import {
  Body,
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

interface TransferRequestConfirmationProps {
  host: string;
  projectIdOld: string;
  projectUrlOld: string;
  userEmail: string;
  senderName?: string;
}

export const TransferRequestConfirmation = ({
  host,
  projectIdOld,
  projectUrlOld,
  userEmail,
  senderName = "openJII",
}: TransferRequestConfirmationProps) => {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Body className="mx-auto my-auto bg-gray-50 font-sans" style={{ color: "#374151" }}>
          <Container className="mx-auto my-[40px] w-[580px] rounded-lg border border-solid border-gray-200 bg-white shadow-sm">
            <Preview>Your project transfer request has been received</Preview>

            {/* Header */}
            <Section className="rounded-t-lg bg-[#005e5e] px-8 py-6">
              <Text className="m-0 text-center text-[28px] font-bold text-white">{senderName}</Text>
            </Section>

            {/* Main Content */}
            <Section className="px-8 py-8">
              <Text className="mb-4 mt-0 text-center text-[24px] font-semibold text-gray-800">
                Transfer Request Received
              </Text>
              <Text className="mb-6 text-center text-[16px] leading-relaxed text-gray-600">
                Thank you for your project transfer request!
              </Text>
              <Text className="mb-8 text-[16px] leading-relaxed text-gray-600">
                We have received your request to transfer the following project from PhotosynQ to
                openJII:
              </Text>

              {/* Project Info Box */}
              <Section className="mb-8 rounded-lg border border-solid border-[#005e5e] bg-gray-50 px-6 py-4">
                <Text className="mb-2 mt-0 text-[14px] font-semibold text-gray-700">
                  Project ID:
                </Text>
                <Text className="mb-4 mt-0 font-mono text-[14px] text-gray-800">
                  {projectIdOld}
                </Text>
                <Text className="mb-2 mt-0 text-[14px] font-semibold text-gray-700">
                  Project URL:
                </Text>
                <Text className="mb-0 mt-0 break-all font-mono text-[14px]">
                  <Link
                    href={projectUrlOld}
                    className="text-[#005e5e] no-underline hover:underline"
                  >
                    {projectUrlOld}
                  </Link>
                </Text>
              </Section>

              <Text className="mb-3 text-[18px] font-semibold text-gray-800">
                What happens next:
              </Text>
              <ul className="mb-6 pl-6 text-[16px] leading-relaxed text-gray-600">
                <li className="mb-2">Our team will review your request.</li>
                <li className="mb-2">
                  We will contact you at <strong>{userEmail}</strong> if we need more information.
                </li>
                <li className="mb-0">
                  You will receive an email notification once the transfer has been completed.
                </li>
              </ul>

              <Hr className="my-6 border-gray-200" />

              <Text className="mb-0 text-[14px] leading-relaxed text-gray-500">
                <strong>Please note:</strong> Project transfers are not immediate and may require up
                to 2 weeks to process. If you have any questions, please contact{" "}
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
