import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { getCmsEmail } from "../lib/contentful";

export interface RenderProjectTransferCompleteParams {
  host: string;
  experimentName: string;
  experimentUrl: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderProjectTransferComplete(
  params: RenderProjectTransferCompleteParams,
): Promise<RenderedEmail> {
  const { host, experimentName, experimentUrl, baseUrl } = params;

  const emailData = await getCmsEmail("project-transfer-complete", {
    host,
    baseUrl,
    experimentName,
    experimentUrl,
  });

  if (!emailData)
    throw new Error("[transactional] CMS email 'project-transfer-complete' not found");

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
