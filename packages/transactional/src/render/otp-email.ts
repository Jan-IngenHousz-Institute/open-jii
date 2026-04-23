import { render } from "@react-email/components";

import { Email } from "../emails/email";
import { OtpEmail } from "../emails/fallbacks/otp-email";
import { getCmsEmail } from "../lib/contentful";

export interface RenderOtpEmailParams {
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

export async function renderOtpEmail(params: RenderOtpEmailParams): Promise<RenderedEmail> {
  const { otp, senderName, host, baseUrl } = params;

  const emailData = await getCmsEmail("otp-email", { otp, senderName, host, baseUrl });

  if (!emailData) {
    const html = await render(OtpEmail({ otp, senderName, host, baseUrl }), {});
    const text = await render(OtpEmail({ otp, senderName, host, baseUrl }), { plainText: true });
    return { html, text, preview: "Your sign-in code for openJII" };
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
