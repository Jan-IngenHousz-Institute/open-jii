import type { EmailRichTextInterface } from "../components/ctf-rich-text";
import { EmailRichText } from "../components/ctf-rich-text";
import { EmailLayout } from "../components/email-layout";

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
    <EmailLayout preview={cmsPreview} senderName={senderName} host={host} baseUrl={baseUrl}>
      <EmailRichText json={cmsContent.json} links={cmsContent.links} />
    </EmailLayout>
  );
};

export default Email;
