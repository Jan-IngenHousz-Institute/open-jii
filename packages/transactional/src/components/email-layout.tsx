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
import React from "react";

export interface EmailLayoutProps {
  preview: string;
  senderName?: string;
  host: string;
  baseUrl: string;
  children: React.ReactNode;
}

export const EmailLayout = ({
  preview,
  senderName = "openJII",
  host,
  baseUrl,
  children,
}: EmailLayoutProps) => {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>{preview}</Preview>
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
            {children}

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

export default EmailLayout;
