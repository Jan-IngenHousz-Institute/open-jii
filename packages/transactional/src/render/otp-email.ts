import { render } from "@react-email/components";

import { OtpEmail } from "../emails/otp-email";

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

  const html = await render(OtpEmail({ otp, senderName, host, baseUrl }), {});
  const text = await render(OtpEmail({ otp, senderName, host, baseUrl }), {
    plainText: true,
  });

  return { html, text };
}
