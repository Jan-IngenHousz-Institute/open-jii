import { Button, Section, Text } from "@react-email/components";

import { EmailLayout } from "../../components/email-layout";

export interface AddedUserNotificationProps {
  experimentName: string;
  experimentUrl: string;
  actor: string;
  role: string;
  senderName?: string;
  host: string;
  baseUrl: string;
}

export const AddedUserNotification = ({
  experimentName,
  experimentUrl,
  actor,
  role,
  senderName = "openJII",
  host,
  baseUrl,
}: AddedUserNotificationProps) => {
  return (
    <EmailLayout
      preview="You've been added to an experiment on openJII"
      senderName={senderName}
      host={host}
      baseUrl={baseUrl}
    >
      <Section className="rounded-t-xl bg-white px-8 pb-4 pt-8">
        <Text className="mb-2 mt-0 text-center text-[24px] font-semibold text-gray-800">
          You've been added to an experiment
        </Text>
        <Text className="mb-6 mt-0 text-center text-[16px] leading-relaxed text-gray-600">
          <strong>{actor}</strong> has added you to <strong>{experimentName}</strong> as{" "}
          <strong>{role}</strong>.
        </Text>
        <Section className="mb-6 text-center">
          <Button
            className="rounded-lg bg-[#005E5E] px-8 py-4 font-semibold text-white no-underline"
            href={experimentUrl}
          >
            View Experiment
          </Button>
        </Section>
        <Text className="mb-0 mt-0 text-center text-[14px] leading-relaxed text-gray-500">
          If you have any questions, please contact your experiment administrator.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default AddedUserNotification;
