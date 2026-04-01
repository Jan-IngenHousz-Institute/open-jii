import {
  Body,
  Container,
  Head,
  Html,
  Img,
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
  baseUrl: string;
  /** HTML from emailmd — when present, replaces the static container body */
  cmsContent?: string;
  /** Preview text from CMS — when present, overrides the static preview */
  cmsPreview?: string;
}

export const TransferRequestConfirmation = ({
  host,
  projectIdOld,
  projectUrlOld,
  userEmail,
  senderName = "openJII",
  baseUrl,
  cmsContent,
  cmsPreview,
}: TransferRequestConfirmationProps) => {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>{cmsPreview ?? "Your project transfer request has been received"}</Preview>
        <Body className="bg-[#005E5E]/15 font-sans">
          {/* Logo */}
          <Section className="w-full text-center">
            <Img
              src={`${baseUrl}/openJII_logo_RGB_horizontal_yellow.png`}
              alt="openJII"
              width={205}
              className="mx-auto"
            />
          </Section>

          <Container className="mx-auto w-full">
            {cmsContent ? (
              <>
                {/* CMS-driven body rendered via emailmd */}
                <div dangerouslySetInnerHTML={{ __html: cmsContent }} />
              </>
            ) : (
              <>
                {/* Main Content — static fallback for local dev preview */}
                <Section className="p-10">
                  <Text className="mb-6 mt-0 text-[24px] font-semibold text-gray-800">
                    Transfer Request Received
                  </Text>
                  <Text className="mb-4 text-[16px] leading-relaxed text-gray-600">
                    Thank you for your project transfer request!
                  </Text>
                  <Text className="mb-6 text-[16px] leading-relaxed text-gray-600">
                    We have received your request to transfer the following project from PhotosynQ
                    to openJII:
                  </Text>

                  {/* Project Info Box */}
                  <Section className="mb-6 rounded-lg border border-solid border-[#005e5e] bg-gray-50 px-6 py-4">
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
                      We will contact you at <strong>{userEmail}</strong> if we need more
                      information.
                    </li>
                    <li className="mb-0">
                      You will receive an email notification once the transfer has been completed.
                    </li>
                  </ul>

                  <Hr className="my-6 border-gray-200" />

                  <Text className="mb-0 text-[14px] leading-relaxed text-gray-500">
                    <strong>Please note:</strong> Project transfers are not immediate and may
                    require up to 2 weeks to process. If you have any questions, please contact{" "}
                    <Link href="mailto:openjii@jii.org" className="text-[#005e5e] underline">
                      openjii@jii.org
                    </Link>
                    .
                  </Text>
                </Section>
              </>
            )}

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

export default TransferRequestConfirmation;

TransferRequestConfirmation.PreviewProps = {
  host: "localhost",
  projectIdOld: "12345",
  projectUrlOld: "https://photosynq.org/projects/12345",
  userEmail: "researcher@example.com",
  senderName: "openJII",
  baseUrl: "http://localhost:3000",
} as TransferRequestConfirmationProps;
