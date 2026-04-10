import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { getCmsEmail } from "../lib/contentful";

export interface RenderTransferRequestConfirmationParams {
  host: string;
  projectIdOld: string;
  projectUrlOld: string;
  userEmail: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderTransferRequestConfirmation(
  params: RenderTransferRequestConfirmationParams,
): Promise<RenderedEmail> {
  const { host, projectIdOld, projectUrlOld, userEmail, baseUrl } = params;

  const emailData = await getCmsEmail("transfer-request-confirmation", {
    host,
    baseUrl,
    projectIdOld,
    projectUrlOld,
    userEmail,
  });

  if (!emailData)
    throw new Error("[transactional] CMS email 'transfer-request-confirmation' not found");

  const html = await render(
    Email({
      host,
      baseUrl,
      cmsPreview: emailData.preview,
      cmsContent: emailData.content,
    }),
    {},
  );

  const text = await render(
    Email({
      host,
      baseUrl,
      cmsPreview: emailData.preview,
      cmsContent: emailData.content,
    }),
    { plainText: true },
  );

  return { html, text, preview: emailData.preview };
}
