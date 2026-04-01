import { render as reactEmailRender } from "@react-email/components";
import { render as emailmdRender } from "emailmd";

import { TransferRequestConfirmation } from "../emails/transfer-request-confirmation";
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

  if (emailData) {
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
      TransferRequestConfirmation({
        host,
        projectIdOld,
        projectUrlOld,
        userEmail,
        baseUrl,
        cmsContent,
        cmsPreview: emailData.preview,
      }),
      {},
    );

    return { html, text };
  }

  // Fallback: static React Email template when CMS is unavailable
  const html = await reactEmailRender(
    TransferRequestConfirmation({ host, projectIdOld, projectUrlOld, userEmail, baseUrl }),
    {},
  );
  const text = await reactEmailRender(
    TransferRequestConfirmation({ host, projectIdOld, projectUrlOld, userEmail, baseUrl }),
    { plainText: true },
  );

  return { html, text };
}
