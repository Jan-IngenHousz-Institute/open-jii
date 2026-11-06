import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { TransferRequestConfirmation } from "../emails/fallbacks/transfer-request-confirmation";
import { getCmsEmail } from "../lib/contentful";

export interface RenderTransferRequestConfirmationParams {
  host: string;
  projectIdOld: string;
  projectUrlOld: string;
  userEmail: string;
  baseUrl: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderTransferRequestConfirmation(
  params: RenderTransferRequestConfirmationParams,
): Promise<RenderedEmail> {
  const { host, projectIdOld, projectUrlOld, userEmail, baseUrl, unsubscribe } = params;

  const emailData = await getCmsEmail("transfer-request-confirmation", {
    host,
    baseUrl,
    projectIdOld,
    projectUrlOld,
    userEmail,
  });

  if (!emailData) {
    const html = await render(
      TransferRequestConfirmation({
        host,
        projectIdOld,
        projectUrlOld,
        userEmail,
        baseUrl,
        unsubscribe,
      }),
      {},
    );
    const text = await render(
      TransferRequestConfirmation({
        host,
        projectIdOld,
        projectUrlOld,
        userEmail,
        baseUrl,
        unsubscribe,
      }),
      { plainText: true },
    );
    return { html, text, preview: "Your transfer request has been received" };
  }

  const html = await render(
    Email({
      host,
      baseUrl,
      cmsPreview: emailData.preview,
      cmsContent: emailData.content,
      unsubscribe,
    }),
    {},
  );

  const text = await render(
    Email({
      host,
      baseUrl,
      cmsPreview: emailData.preview,
      cmsContent: emailData.content,
      unsubscribe,
    }),
    { plainText: true },
  );

  return { html, text, preview: emailData.preview };
}
