import { render as reactEmailRender } from "@react-email/components";
import { render as emailmdRender } from "emailmd";

import { Email } from "../emails/email.js";
import { getCmsEmail, interpolate } from "../lib/contentful";

export interface RenderOtpEmailParams {
  otp: string;
  senderName: string;
  host: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderOtpEmail(params: RenderOtpEmailParams): Promise<RenderedEmail> {
  const { otp, senderName, host, baseUrl } = params;

  const emailData = await getCmsEmail("otp-email");

  if (!emailData) throw new Error("[transactional] CMS email 'otp-email' not found");

  const markdown = interpolate(emailData.content, { otp, senderName, host, baseUrl });
  const { html: fullHtml, text } = emailmdRender(markdown);
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(fullHtml);
  const cmsContent = bodyMatch?.[1] ?? fullHtml;

  const html = await reactEmailRender(
    Email({ senderName, host, baseUrl, cmsContent, cmsPreview: emailData.preview }),
    {},
  );

  return { html, text };
}
