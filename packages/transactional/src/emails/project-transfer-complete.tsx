import {
  Body,
  Button,
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

interface ProjectTransferCompleteProps {
  host: string;
  experimentName: string;
  experimentUrl: string;
  senderName?: string;
  baseUrl: string;
  /** HTML from emailmd — when present, replaces the static container body */
  cmsContent?: string;
  /** Preview text from CMS — when present, overrides the static preview */
  cmsPreview?: string;
}

export const ProjectTransferComplete = ({
  host,
  experimentName,
  experimentUrl,
  senderName = "openJII",
  baseUrl,
  cmsContent,
  cmsPreview,
}: ProjectTransferCompleteProps) => {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>{cmsPreview ?? "Your project transfer is complete"}</Preview>
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
                    Transfer Complete
                  </Text>
                  <Text className="mb-4 text-[16px] leading-relaxed text-gray-600">
                    Your project has been successfully transferred to openJII!
                  </Text>
                  <Text className="mb-8 text-[16px] leading-relaxed text-gray-600">
                    The experiment <strong>"{experimentName}"</strong> is now available on the
                    openJII platform. You have been added as an admin and can start collaborating
                    right away.
                  </Text>

                  <Section className="mb-8 text-center">
                    <Button
                      className="rounded-lg bg-[#005e5e] px-8 py-4 font-semibold text-white no-underline shadow-md transition-colors hover:bg-[#004747]"
                      href={experimentUrl}
                    >
                      View Experiment
                    </Button>
                  </Section>

                  <Hr className="my-6 border-gray-200" />

                  <Text className="mb-3 text-[14px] leading-relaxed text-gray-500">
                    <strong>Having trouble?</strong> If the button above doesn't work, copy and
                    paste this link into your browser:
                  </Text>
                  <Text className="break-all rounded border bg-gray-50 p-3 font-mono text-[14px]">
                    <Link
                      href={experimentUrl}
                      className="text-[#005e5e] no-underline hover:underline"
                    >
                      {experimentUrl}
                    </Link>
                  </Text>

                  <Text className="mb-0 mt-6 text-[14px] leading-relaxed text-gray-500">
                    If you have any questions, please contact{" "}
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

export default ProjectTransferComplete;

ProjectTransferComplete.PreviewProps = {
  host: "localhost",
  experimentName: "My Experiment",
  experimentUrl: "http://localhost:3000/en-US/platform/experiments/123",
  senderName: "openJII",
  baseUrl: "http://localhost:3000",
} as ProjectTransferCompleteProps;
