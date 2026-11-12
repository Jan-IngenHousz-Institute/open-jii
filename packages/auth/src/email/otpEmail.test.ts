import { createTransport } from "nodemailer";
import { describe, expect, it, vi } from "vitest";

import { sendOtpEmail } from "./otpEmail";

const sendMail = vi.fn(() => Promise.resolve());

vi.mock("nodemailer", () => ({ createTransport: vi.fn(() => ({ sendMail })) }));
vi.mock("@repo/transactional/render/otp-email", () => ({
  renderOtpEmail: vi.fn(() => Promise.resolve({ html: "<p>123456</p>", text: "123456" })),
}));

const params = {
  to: "carol@uni.edu",
  otp: "123456",
  emailServer: "smtp://127.0.0.1:1025",
  emailFrom: "noreply@openjii.local",
  senderName: "openJII",
  baseUrl: "http://localhost:3000",
};

describe("sendOtpEmail", () => {
  it("calls a sign-in code a login code", async () => {
    await sendOtpEmail(params);

    expect(createTransport).toHaveBeenCalledWith("smtp://127.0.0.1:1025");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "carol@uni.edu", subject: "Your login code for openJII" }),
    );
  });

  it("says what a code for a new address is for", async () => {
    await sendOtpEmail({ ...params, purpose: "confirm-email" });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Your code to confirm your email address for openJII",
      }),
    );
  });
});
