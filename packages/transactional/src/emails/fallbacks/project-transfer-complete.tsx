import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface ProjectTransferCompleteProps {
  experimentName: string;
  experimentUrl: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const ProjectTransferComplete = ({
  experimentName,
  experimentUrl,
  senderName = "openJII",
  host,
  baseUrl,
}: ProjectTransferCompleteProps) => {
  return (
    <EmailLayout
      preview="Your project transfer has been completed"
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          Project Transfer Complete
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          The project <strong>{experimentName}</strong> has been successfully transferred to your
          account.
        </Text>
        <Section className="mb-6 text-center">
          <Button
            className="rounded-lg bg-[#005E5E] px-8 py-4 font-semibold text-white no-underline"
            href={experimentUrl}
          >
            View Project
          </Button>
        </Section>
        <Text className="mb-0 mt-0 text-center text-[14px] leading-relaxed text-gray-500">
          If you did not expect this transfer, please contact your administrator immediately.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default ProjectTransferComplete;
