import { createTransport } from "nodemailer";
import { describe, expect, it, vi } from "vitest";

import { renderConfirmEmailOtp } from "@repo/transactional/render/confirm-email-otp";

import { sendConfirmEmailOtpEmail } from "./confirmEmailOtpEmail";

const sendMail = vi.fn(() => Promise.resolve());

vi.mock("nodemailer", () => ({ createTransport: vi.fn(() => ({ sendMail })) }));
vi.mock("@repo/transactional/render/confirm-email-otp", () => ({
  renderConfirmEmailOtp: vi.fn(() => Promise.resolve({ html: "<p>654321</p>", text: "654321" })),
}));

describe("sendConfirmEmailOtpEmail", () => {
  it("sends the confirm-address email with a subject that says what the code is for", async () => {
    await sendConfirmEmailOtpEmail({
      to: "carol@uni.edu",
      otp: "654321",
      emailServer: "smtp://127.0.0.1:1025",
      emailFrom: "noreply@openjii.local",
      senderName: "openJII",
      baseUrl: "http://localhost:3000",
    });

    expect(renderConfirmEmailOtp).toHaveBeenCalledWith({
      otp: "654321",
      senderName: "openJII",
      host: "localhost:3000",
      baseUrl: "http://localhost:3000",
    });
    expect(createTransport).toHaveBeenCalledWith("smtp://127.0.0.1:1025");
    expect(sendMail).toHaveBeenCalledWith({
      to: "carol@uni.edu",
      from: { name: "openJII", address: "noreply@openjii.local" },
      subject: "Your code to confirm your email address for openJII",
      html: "<p>654321</p>",
      text: "654321",
    });
  });
});
