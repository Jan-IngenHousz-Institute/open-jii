import { render as reactEmailRender } from "@react-email/components";
import { render as emailmdRender } from "emailmd";

import { Email } from "../emails/email.js";
import { getCmsEmail, interpolate } from "../lib/contentful";

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
}

export async function renderTransferRequestConfirmation(
  params: RenderTransferRequestConfirmationParams,
): Promise<RenderedEmail> {
  const { host, projectIdOld, projectUrlOld, userEmail, baseUrl } = params;

  const emailData = await getCmsEmail("transfer-request-confirmation");

  if (!emailData)
    throw new Error("[transactional] CMS email 'transfer-request-confirmation' not found");

  const markdown = interpolate(emailData.content, {
    host,
    baseUrl,
    projectIdOld,
    projectUrlOld,
    userEmail,
  });
  const { html: fullHtml, text } = emailmdRender(markdown);
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(fullHtml);
  const cmsContent = bodyMatch?.[1] ?? fullHtml;

  const html = await reactEmailRender(
    Email({
      host,
      baseUrl,
      cmsContent,
      cmsPreview: emailData.preview,
    }),
    {},
  );

  return { html, text };
}
