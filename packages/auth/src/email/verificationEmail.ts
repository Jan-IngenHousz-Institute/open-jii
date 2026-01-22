import { render } from "@react-email/components";
import { createTransport } from "nodemailer";
import type { SentMessageInfo } from "nodemailer";
import QRCode from "qrcode";

import { VerificationRequest } from "@repo/transactional/emails/verification-request";

interface ExtendedSentMessageInfo extends SentMessageInfo {
  rejected?: string[];
  pending?: string[];
}

interface SendVerificationEmailParams {
  to: string;
  url: string;
  token: string;
  emailServer: string;
  emailFrom: string;
}

export async function sendVerificationEmail(params: SendVerificationEmailParams) {
  const { to, url, emailServer, emailFrom } = params;

  const { host } = new URL(url);
  const transport = createTransport(emailServer);

  const qrCodeBuffer = await QRCode.toBuffer(url, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  // Render email using React Email component
  const emailHtml = await render(VerificationRequest({ url, host, senderName: "openJII" }), {});
  const emailText = await render(VerificationRequest({ url, host, senderName: "openJII" }), {
    plainText: true,
  });

  const result = await transport.sendMail({
    to,
    from: {
      name: "openJII",
      address: emailFrom,
    },
    subject: `Sign in to the openJII Platform`,
    html: emailHtml,
    text: emailText,
    attachments: [
      {
        filename: "qrcode.png",
        content: qrCodeBuffer,
        cid: "qrcode",
      },
    ],
  });

  const extendedResult = result as ExtendedSentMessageInfo;
  const rejected: string[] = extendedResult.rejected ?? [];
  const pending: string[] = extendedResult.pending ?? [];
  const failed: string[] = rejected.concat(pending).filter(Boolean);

  if (failed.length > 0) {
    const failedAddresses = failed.map((failedAddress: string) =>
      typeof failedAddress === "object" && "address" in failedAddress
        ? (failedAddress as { address: string }).address
        : failedAddress,
    );
    throw new Error(`Email (${failedAddresses.join(", ")}) could not be sent`);
  }
}
