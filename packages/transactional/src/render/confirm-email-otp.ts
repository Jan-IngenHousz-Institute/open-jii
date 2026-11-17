import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { ConfirmEmailOtp } from "../emails/fallbacks/confirm-email-otp";
import { getCmsEmail } from "../lib/contentful";

export interface RenderConfirmEmailOtpParams {
  otp: string;
  senderName: string;
  host: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderConfirmEmailOtp(
  params: RenderConfirmEmailOtpParams,
): Promise<RenderedEmail> {
  const { otp, senderName, host, baseUrl } = params;

  const emailData = await getCmsEmail("confirm-email-otp", { otp, senderName, host, baseUrl });

  if (!emailData) {
    const html = await render(ConfirmEmailOtp({ otp, senderName, host, baseUrl }), {});
    const text = await render(ConfirmEmailOtp({ otp, senderName, host, baseUrl }), {
      plainText: true,
    });
    return { html, text, preview: "Your code to confirm your email address for openJII" };
  }

  const html = await render(
    Email({
      senderName,
      host,
      baseUrl,
      cmsPreview: emailData.preview,
      cmsContent: emailData.content,
    }),
    {},
  );

  const text = await render(
    Email({
      senderName,
      host,
      baseUrl,
      cmsPreview: emailData.preview,
      cmsContent: emailData.content,
    }),
    { plainText: true },
  );

  return { html, text, preview: emailData.preview };
}
