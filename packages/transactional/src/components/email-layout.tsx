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
} from "@react-email/components";
import React from "react";

export interface EmailUnsubscribe {
  categoryLabel: string;
  settingsUrl: string;
  unsubscribeUrl: string;
}

export interface EmailLayoutProps {
  preview: string;
  senderName?: string;
  host: string;
  baseUrl: string;
  unsubscribe?: EmailUnsubscribe;
  children: React.ReactNode;
}

export const EmailLayout = ({
  preview,
  senderName = "openJII",
  host,
  baseUrl,
  unsubscribe,
  children,
}: EmailLayoutProps) => {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>{preview}</Preview>
        <Body className="bg-[#005E5E]/15 pb-6 pt-4 font-sans">
          <Section className="w-full text-center">
            <Img
              src={`${baseUrl}/openJII_logo_RGB_horizontal_green_yellow.svg`}
              alt="openJII"
              width={205}
              className="mx-auto"
            />
          </Section>

          <Container className="mx-auto w-full">
            {children}

            {/* Footer */}
            <Section className="rounded-b-xl border-t border-gray-100 bg-gray-50 px-8 py-2">
              {unsubscribe && (
                <>
                  <Text className="m-0 text-center text-[12px] text-gray-400">
                    You get this email because <strong>{unsubscribe.categoryLabel}</strong> emails
                    are on.
                  </Text>
                  <Text className="m-0 text-center text-[12px] text-gray-400">
                    <Link href={unsubscribe.settingsUrl} className="text-[#005E5E] underline">
                      Manage notification settings
                    </Link>
                    {" · "}
                    <Link href={unsubscribe.unsubscribeUrl} className="text-[#005E5E] underline">
                      Unsubscribe from these emails
                    </Link>
                  </Text>
                </>
              )}
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
