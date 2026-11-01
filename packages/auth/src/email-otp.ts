import { emailOTP } from "better-auth/plugins";

import { PlayReviewAccount } from "./play-review-account";

const OTP_LENGTH = 6;

interface OTPMessage {
  email: string;
  otp: string;
}

interface OpenJiiEmailOTPOptions {
  playReview: { email: string | undefined; otp: string | undefined };
  sendEmail: (message: OTPMessage) => Promise<void>;
}

/**
 * Email OTP sign-in as openJII configures it, Google Play review account included. Built here
 * rather than inline in the auth instance so tests drive the same generate and send path through a
 * real Better Auth instance.
 */
export function openJiiEmailOTP({ playReview, sendEmail }: OpenJiiEmailOTPOptions) {
  const playReviewAccount = PlayReviewAccount.fromSettings({
    ...playReview,
    otpLength: OTP_LENGTH,
  });

  return emailOTP({
    otpLength: OTP_LENGTH,
    generateOTP: (request) => playReviewAccount?.generateOTP(request),
    async sendVerificationOTP(request, ctx) {
      if (playReviewAccount?.isReviewSignIn(request)) {
        ctx?.context.logger.info("Issued the Play review sign-in code without sending an email");
        return;
      }

      await sendEmail(request);
    },
  });
}
