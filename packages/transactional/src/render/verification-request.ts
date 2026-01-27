import { render } from "@react-email/components";
import QRCode from "qrcode";

import { VerificationRequest } from "../emails/verification-request";

export interface RenderVerificationRequestParams {
  url: string;
  host: string;
  senderName: string;
}

export interface RenderedEmailWithAttachment {
  html: string;
  text: string;
  qrCodeBuffer: Buffer;
}

export async function renderVerificationRequest(
  params: RenderVerificationRequestParams,
): Promise<RenderedEmailWithAttachment> {
  const { url, host, senderName } = params;

  // Generate QR code
  const qrCodeBuffer = await QRCode.toBuffer(url, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  // Render email
  const html = await render(VerificationRequest({ url, host, senderName }), {});
  const text = await render(VerificationRequest({ url, host, senderName }), {
    plainText: true,
  });

  return { html, text, qrCodeBuffer };
}
