import { render } from "@react-email/components";

import { OtpEmail } from "../emails/otp-email";

export interface RenderOtpEmailParams {
  otp: string;
  senderName: string;
  host: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderOtpEmail(params: RenderOtpEmailParams): Promise<RenderedEmail> {
  const { otp, senderName, host } = params;

  const html = await render(OtpEmail({ otp, senderName, host }), {});
  const text = await render(OtpEmail({ otp, senderName, host }), {
    plainText: true,
  });

  return { html, text };
}
