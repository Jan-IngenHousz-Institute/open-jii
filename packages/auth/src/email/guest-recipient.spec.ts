import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendOrganizationInvitationEmail } from "./invitationEmail";
import { sendOtpEmail } from "./otpEmail";
import { sendVerificationEmail } from "./verificationEmail";

const { recipient, transport, send } = vi.hoisted(() => ({
  recipient: vi.fn<(email: string) => Promise<boolean>>(),
  transport: vi.fn(),
  send: vi.fn(),
}));
vi.mock("../guest/recipient", () => ({ isGuestRecipient: recipient }));
vi.mock("nodemailer", () => ({ createTransport: transport }));
vi.mock("@repo/transactional/render/otp-email", () => ({
  renderOtpEmail: vi.fn().mockResolvedValue({ html: "synthetic", text: "synthetic" }),
}));
vi.mock("@repo/transactional/render/organization-invitation", () => ({
  renderOrganizationInvitation: vi.fn().mockResolvedValue({ html: "synthetic", text: "synthetic" }),
}));
vi.mock("@repo/transactional/render/verification-request", () => ({
  renderVerificationRequest: vi
    .fn()
    .mockResolvedValue({ html: "synthetic", text: "synthetic", qrCodeBuffer: Buffer.from("") }),
}));

const base = {
  to: "synthetic@example.test",
  emailServer: "smtp://example.test",
  emailFrom: "sender@example.test",
  senderName: "openJII",
  baseUrl: "https://example.test",
};
const deliveries = [
  { name: "OTP", run: () => sendOtpEmail({ ...base, otp: "123456" }) },
  {
    name: "invitation",
    run: () =>
      sendOrganizationInvitationEmail({
        ...base,
        inviteUrl: "https://example.test/invitation",
        organizationName: "Synthetic",
        inviterName: "Synthetic",
        role: "member",
      }),
  },
  {
    name: "verification",
    run: () =>
      sendVerificationEmail({
        ...base,
        url: "https://example.test/verification",
        token: "synthetic",
      }),
  },
];

describe("guest mail boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recipient.mockResolvedValue(false);
    transport.mockReturnValue({ sendMail: send });
    send.mockResolvedValue({ rejected: [], pending: [] });
  });
  afterEach(() => vi.restoreAllMocks());
  it.each(deliveries)("sends no $name email for a guest", async ({ run }) => {
    recipient.mockResolvedValue(true);
    await run();
    expect(recipient).toHaveBeenCalledWith(base.to);
    expect(transport).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it.each(deliveries)("keeps ordinary $name email delivery", async ({ run }) => {
    await run();
    expect(send).toHaveBeenCalledOnce();
  });
});
