import { render } from "@react-email/components";
import { createTransport } from "nodemailer";

import { OtpEmail } from "@repo/transactional/emails/otp-email";

interface SendOtpEmailParams {
  to: string;
  otp: string;
  emailServer: string;
  emailFrom: string;
  baseUrl: string;
}

export async function sendOtpEmail(params: SendOtpEmailParams) {
  const { to, otp, emailServer, emailFrom, baseUrl } = params;

  const transport = createTransport(emailServer);

  const emailHtml = await render(OtpEmail({ otp, baseUrl }), {});
  const emailText = await render(OtpEmail({ otp, baseUrl }), {
    plainText: true,
  });

  await transport.sendMail({
    to,
    from: {
      name: "openJII",
      address: emailFrom,
    },
    subject: `Your login code for openJII`,
    html: emailHtml,
    text: emailText,
  });
}
