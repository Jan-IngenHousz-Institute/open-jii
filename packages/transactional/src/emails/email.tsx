import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

import type { EmailRichTextInterface } from "../components/ctf-rich-text";
import { EmailRichText } from "../components/ctf-rich-text";

export interface EmailProps {
  host: string;
  senderName?: string;
  baseUrl: string;
  cmsPreview: string;
  cmsContent: EmailRichTextInterface;
}

export const Email = ({
  host,
  senderName = "openJII",
  baseUrl,
  cmsPreview,
  cmsContent,
}: EmailProps) => {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>{cmsPreview}</Preview>
        <Body className="bg-[#005E5E]/15 font-sans">
          <Section className="w-full text-center">
            <Img
              src={`${baseUrl}/openJII_logo_RGB_horizontal_yellow.png`}
              alt="openJII"
              width={205}
              className="mx-auto"
            />
          </Section>

          <Container className="mx-auto w-full">
            <EmailRichText json={cmsContent.json} links={cmsContent.links} />

            {/* Footer */}
            <Section className="rounded-b-xl border-t border-gray-100 bg-gray-50 px-8 py-4">
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

export default Email;
