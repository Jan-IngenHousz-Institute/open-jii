import { createTransport } from "nodemailer";
import { describe, expect, it, vi } from "vitest";

import { renderOtpEmail } from "@repo/transactional/render/otp-email";

import { sendOtpEmail } from "./otpEmail";

const sendMail = vi.fn(() => Promise.resolve());

vi.mock("nodemailer", () => ({ createTransport: vi.fn(() => ({ sendMail })) }));
vi.mock("@repo/transactional/render/otp-email", () => ({
  renderOtpEmail: vi.fn(() => Promise.resolve({ html: "<p>123456</p>", text: "123456" })),
}));

describe("sendOtpEmail", () => {
  it("sends the sign-in email with a login-code subject", async () => {
    await sendOtpEmail({
      to: "carol@uni.edu",
      otp: "123456",
      emailServer: "smtp://127.0.0.1:1025",
      emailFrom: "noreply@openjii.local",
      senderName: "openJII",
      baseUrl: "http://localhost:3000",
    });

    expect(renderOtpEmail).toHaveBeenCalledWith({
      otp: "123456",
      senderName: "openJII",
      host: "localhost:3000",
      baseUrl: "http://localhost:3000",
    });
    expect(createTransport).toHaveBeenCalledWith("smtp://127.0.0.1:1025");
    expect(sendMail).toHaveBeenCalledWith({
      to: "carol@uni.edu",
      from: { name: "openJII", address: "noreply@openjii.local" },
      subject: "Your login code for openJII",
      html: "<p>123456</p>",
      text: "123456",
    });
  });
});
