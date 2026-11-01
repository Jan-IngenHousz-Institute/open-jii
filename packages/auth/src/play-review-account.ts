import type { EmailOTPOptions } from "better-auth/plugins";
import { z } from "zod";

type OTPRequest = Pick<Parameters<EmailOTPOptions["sendVerificationOTP"]>[0], "email" | "type">;

interface PlayReviewSettings {
  email: string | undefined;
  otp: string | undefined;
  otpLength: number;
}

/**
 * The address Google Play's reviewers sign in with. Play requires reusable credentials that bypass
 * one-time codes, so every sign-in code issued to this address is the configured code and no email
 * goes out. Verification still runs through Better Auth, attempt limits included.
 */
export class PlayReviewAccount {
  private constructor(
    private readonly email: string,
    private readonly otp: string,
  ) {}

  /**
   * Returns null when neither setting is present. A partial or malformed pair throws, so a deploy
   * cannot half-enable a standing sign-in code.
   */
  static fromSettings({ email, otp, otpLength }: PlayReviewSettings): PlayReviewAccount | null {
    if (!email && !otp) {
      return null;
    }

    if (!email || !otp) {
      throw new Error("AUTH_PLAY_REVIEW_EMAIL and AUTH_PLAY_REVIEW_OTP must be set together");
    }

    const normalizedEmail = email.toLowerCase();
    const isEmail = z.email().safeParse(normalizedEmail).success;
    if (!isEmail) {
      throw new Error("AUTH_PLAY_REVIEW_EMAIL is not a valid email address");
    }

    // The sign-in screens accept digits only.
    const isOtpShaped = otp.length === otpLength && /^\d+$/.test(otp);
    if (!isOtpShaped) {
      throw new Error(`AUTH_PLAY_REVIEW_OTP must be exactly ${otpLength} digits`);
    }

    return new PlayReviewAccount(normalizedEmail, otp);
  }

  isReviewSignIn({ email, type }: OTPRequest): boolean {
    return type === "sign-in" && email.toLowerCase() === this.email;
  }

  /** The configured code for the review sign-in; undefined lets Better Auth generate one. */
  generateOTP(request: OTPRequest): string | undefined {
    if (this.isReviewSignIn(request)) {
      return this.otp;
    }

    return undefined;
  }
}
