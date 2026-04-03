import { render as reactEmailRender } from "@react-email/components";
import { render as emailmdRender } from "emailmd";

import { Email } from "../emails/email.js";
import { getCmsEmail, interpolate } from "../lib/contentful";

export interface RenderProjectTransferCompleteParams {
  host: string;
  experimentName: string;
  experimentUrl: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderProjectTransferComplete(
  params: RenderProjectTransferCompleteParams,
): Promise<RenderedEmail> {
  const { host, experimentName, experimentUrl, baseUrl } = params;

  const emailData = await getCmsEmail("project-transfer-complete");

  if (!emailData)
    throw new Error("[transactional] CMS email 'project-transfer-complete' not found");

  const markdown = interpolate(emailData.content, {
    host,
    baseUrl,
    experimentName,
    experimentUrl,
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
