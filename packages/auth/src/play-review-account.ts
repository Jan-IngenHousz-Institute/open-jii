import type { EmailOTPOptions } from "better-auth/plugins";
import { z } from "zod";

type OTPRequest = Pick<Parameters<EmailOTPOptions["sendVerificationOTP"]>[0], "email" | "type">;

interface PlayReviewSettings {
  email: string | undefined;
  otp: string | undefined;
  otpLength: number;
}

// Reviewers sign in a handful of times a day. With at most three backend tasks counting on their
// own, a guesser gets a few dozen tries a day, which puts six digits decades away on average.
const DAILY_SIGN_IN_ATTEMPTS_PER_TASK = 10;

/**
 * The address Google Play's reviewers sign in with. Play requires reusable credentials that bypass
 * one-time codes, so every sign-in code issued to this address is the configured code and no email
 * goes out. Verification still runs through Better Auth, attempt limits included, and the address
 * gets a daily cap on sign-in attempts that a new code does not reset.
 */
export class PlayReviewAccount {
  private attemptsDay = "";
  private attempts = 0;

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

  isReviewAddress(email: string): boolean {
    return email.toLowerCase() === this.email;
  }

  isReviewSignIn({ email, type }: OTPRequest): boolean {
    return type === "sign-in" && this.isReviewAddress(email);
  }

  /** The configured code for the review sign-in; undefined lets Better Auth generate one. */
  generateOTP(request: OTPRequest): string | undefined {
    if (this.isReviewSignIn(request)) {
      return this.otp;
    }

    return undefined;
  }

  /**
   * Counts one sign-in attempt for the review address and says whether it is within today's cap,
   * in UTC days. The count lives in this process, so each backend task has its own.
   */
  recordSignInAttempt(now = new Date()): boolean {
    const today = now.toISOString().slice(0, 10);
    if (today !== this.attemptsDay) {
      this.attemptsDay = today;
      this.attempts = 0;
    }

    this.attempts += 1;
    return this.attempts <= DAILY_SIGN_IN_ATTEMPTS_PER_TASK;
  }
}
