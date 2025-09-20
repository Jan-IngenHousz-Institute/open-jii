import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface VerificationRequestProps {
  url: string;
}

export const VerificationRequest = ({ url }: VerificationRequestProps) => {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans" style={{ color: "#005e5e" }}>
          <Container className="mx-auto my-[40px] w-[550px] rounded border border-solid border-[#eaeaea] p-[20px]">
            <Preview>Verification request</Preview>
            <Section>
              <Text className="text-[22px]">openJII</Text>
            </Section>
            <Section className="mb-[16px] mt-[16px] text-center">
              <Text className="text-[22px]">Confirm your email address to sign in</Text>
            </Section>
            <Section className="mb-[16px] mt-[16px] text-center">
              <Button
                className="rounded bg-[#005e5e] px-4 py-3 font-bold text-white no-underline"
                href={url}
              >
                Confirm and sign in
              </Button>
            </Section>
            <Section>
              <Text className="text-[16px] leading-[24px]">
                If the button above is not clickable, copy-paste the following url into your web
                browser:
              </Text>
              <Text className="text-[16px] leading-[24px]">{url}</Text>
              <Text className="text-[16px] leading-[24px]">
                If you didn't request this email, there's nothing to worry about - you can safely
                ignore it.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

VerificationRequest.PreviewProps = {
  url: "https://openjii.org/",
};
