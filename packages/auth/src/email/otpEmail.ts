import { render } from "@react-email/components";
import { createTransport } from "nodemailer";

import { OtpEmail } from "@repo/transactional/emails/otp-email";

interface SendOtpEmailParams {
  to: string;
  otp: string;
  emailServer: string;
  emailFrom: string;
  senderName: string;
  baseUrl: string;
}

export async function sendOtpEmail(params: SendOtpEmailParams) {
  const { to, otp, emailServer, emailFrom, senderName, baseUrl } = params;

  const url = new URL(baseUrl);
  const host = url.host;

  const transport = createTransport(emailServer);

  const emailHtml = await render(OtpEmail({ otp, senderName, host }), {});
  const emailText = await render(OtpEmail({ otp, senderName, host }), {
    plainText: true,
  });

  await transport.sendMail({
    to,
    from: {
      name: senderName,
      address: emailFrom,
    },
    subject: `Your login code for ${senderName}`,
    html: emailHtml,
    text: emailText,
  });
}
