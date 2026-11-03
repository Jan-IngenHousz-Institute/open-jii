import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { z } from "zod";

import { PlayReviewAccount } from "./play-review-account";

const OTP_LENGTH = 6;
const SIGN_IN_PATH = "/sign-in/email-otp";

// Checks a code without using it up. Neither app calls it, so it would only be a second way to
// guess the review code.
export const DISABLED_EMAIL_OTP_PATHS = ["/email-otp/check-verification-otp"];

const zSignInBody = z.object({ email: z.string() });

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

  function isReviewSignIn(body: unknown): boolean {
    const parsed = zSignInBody.safeParse(body);
    return (
      parsed.success &&
      !!playReviewAccount?.isReviewSignIn({ email: parsed.data.email, type: "sign-in" })
    );
  }

  const plugin = emailOTP({
    otpLength: OTP_LENGTH,
    // Not hashed: a six-digit code is recovered from its hash by trying all of them.
    storeOTP: "encrypted",
    generateOTP: (request) => playReviewAccount?.generateOTP(request),
    async sendVerificationOTP(request, ctx) {
      if (playReviewAccount?.isReviewSignIn(request)) {
        ctx?.context.logger.info("Issued the Play review sign-in code without sending an email");
        return;
      }

      await sendEmail(request);
    },
  });

  const isSignInPath = (context: { path?: string }) => context.path === SIGN_IN_PATH;

  // A refusal thrown here skips the after hooks, so it logs itself. Neither line names the address.
  const capReviewSignIn = createAuthMiddleware((ctx) => {
    if (!playReviewAccount || !isReviewSignIn(ctx.body)) {
      return Promise.resolve();
    }

    const isWithinCap = playReviewAccount.recordSignInAttempt();
    if (!isWithinCap) {
      ctx.context.logger.warn("Play review sign-in refused: today's attempts are used up");
      throw new APIError("TOO_MANY_REQUESTS", { message: "Too many sign-in attempts" });
    }

    return Promise.resolve();
  });

  const logFailedReviewSignIn = createAuthMiddleware((ctx) => {
    const { returned } = ctx.context;
    if (isReviewSignIn(ctx.body) && returned instanceof APIError) {
      ctx.context.logger.warn("Play review sign-in failed", { reason: returned.body?.code });
    }

    return Promise.resolve();
  });

  return {
    ...plugin,
    hooks: {
      ...plugin.hooks,
      before: [{ matcher: isSignInPath, handler: capReviewSignIn }],
      after: [...plugin.hooks.after, { matcher: isSignInPath, handler: logFailedReviewSignIn }],
    },
  };
}
