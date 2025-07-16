import type { NodemailerConfig } from "@auth/core/providers/nodemailer";
import { createTransport } from "nodemailer";

function verificationRequestHTML(params: { url: string; host: string }) {
  const { url } = params;

  const color = {
    background: "#f9f9f9",
    text: "#005e5e",
    mainBackground: "#fff",
    buttonBackground: "#005e5e",
    buttonBorder: "#005e5e",
    buttonText: "#fff",
  };

  return `
<body style="background: ${color.mainBackground};">
  <table width="100%" border="0" cellspacing="20" cellpadding="0"
    style="background: ${color.background}; max-width: 600px; margin: auto; border-radius: 10px;">
    <tr>
      <td align="left"
        style="padding: 15px 0; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        openJII
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 10px 0; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Confirm your email address to sign in
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="border-radius: 5px;" bgcolor="${color.buttonBackground}"><a href="${url}"
                target="_blank"
                style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${color.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${color.buttonBorder}; display: inline-block; font-weight: bold;">Confirm and sign in</a></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 0 0 3px 0; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        If the button above is not clickable, copy-paste the following url into your web browser:
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 0 0 10px 0; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        ${url}
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 0 0 10px 0; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        If you didn't request this email, there's nothing to worry about - you can safely ignore it.
      </td>
    </tr>
  </table>
</body>
`;
}

/** Email Text body (fallback for email clients that don't render HTML, e.g. feature phones) */
function verificationRequestText({ url, host }: { url: string; host: string }) {
  return `Sign in to ${host}\n${url}\n\n`;
}

export async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  expires: Date;
  provider: NodemailerConfig;
  token: string;
  request: Request;
}) {
  console.log("sendVerificationRequest", params);
  const { identifier, url, provider } = params;
  const { host } = new URL(url);
  const transport = createTransport(provider.server);
  const result = await transport.sendMail({
    to: identifier,
    from: provider.from,
    subject: `Sign in to ${host}`,
    text: verificationRequestText({ url, host }),
    html: verificationRequestHTML({ url, host }),
  });
  const rejected = result.rejected;
  const pending = result.pending;
  const failed = rejected.concat(pending).filter(Boolean);
  if (failed.length) {
    const failedAddresses = failed.map((failedAddress) =>
      typeof failedAddress === "object" && "address" in failedAddress
        ? failedAddress.address
        : failedAddress,
    );
    throw new Error(`Email (${failedAddresses.join(", ")}) could not be sent`);
  }
}
