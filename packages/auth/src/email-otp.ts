import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { z } from "zod";

import { PlayReviewAccount } from "./play-review-account";

const OTP_LENGTH = 6;
const SIGN_IN_PATH = "/sign-in/email-otp";

// Each of these leaves the review account a way in that a new code does not close: a passkey, an
// API key, a linked GitHub or ORCID account, or the account moved to an address someone else reads.
const NEW_SIGN_IN_METHOD_PATHS = [
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/api-key/create",
  "/link-social",
  "/change-email",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
];

/** What the auth server logs about the review account. The backend's metric filter matches these. */
export const PLAY_REVIEW_LOG_LINES = {
  signInSucceeded: "Play review sign-in succeeded",
  signInFailed: "Play review sign-in failed",
  signInRefused: "Play review sign-in refused",
  newSignInMethodRefused: "Play review account refused a new sign-in method",
};

const zSignInBody = z.object({ email: z.string(), otp: z.string() });

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

  // Before hooks see the body unvalidated, so a body that would fail validation counts as nothing.
  function isReviewSignInBody(body: unknown): boolean {
    const parsed = zSignInBody.safeParse(body);
    return parsed.success && !!playReviewAccount?.isReviewAddress(parsed.data.email);
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

  // Checks a code without using it up. Neither app calls it, so it would only be a second way to
  // guess the review code.
  const { checkVerificationOTP: _checkVerificationOTP, ...endpoints } = plugin.endpoints;

  // Read through the shared shape, so hooks a later version declares are carried, not dropped.
  const declaredHooks: BetterAuthPlugin["hooks"] = plugin.hooks;

  const isSignInPath = (context: { path?: string }) => context.path === SIGN_IN_PATH;
  const isNewSignInMethodPath = (context: { path?: string }) =>
    !!context.path && NEW_SIGN_IN_METHOD_PATHS.includes(context.path);

  // A refusal thrown here skips the after hooks, so it logs itself. No line names the address.
  const capReviewSignIn = createAuthMiddleware((ctx) => {
    if (!playReviewAccount || !isReviewSignInBody(ctx.body)) {
      return Promise.resolve();
    }

    const isWithinCap = playReviewAccount.recordSignInAttempt();
    if (!isWithinCap) {
      ctx.context.logger.warn(PLAY_REVIEW_LOG_LINES.signInRefused, { reason: "daily cap" });
      throw new APIError("TOO_MANY_REQUESTS", { message: "Too many sign-in attempts" });
    }

    return Promise.resolve();
  });

  const refuseNewSignInMethod = createAuthMiddleware(async (ctx) => {
    if (!playReviewAccount) {
      return;
    }

    const session = await getSessionFromCtx(ctx);
    const isReviewSession = !!session && playReviewAccount.isReviewAddress(session.user.email);
    if (isReviewSession) {
      ctx.context.logger.warn(PLAY_REVIEW_LOG_LINES.newSignInMethodRefused, { path: ctx.path });
      throw new APIError("FORBIDDEN", { message: "This account cannot add sign-in methods" });
    }
  });

  const logReviewSignIn = createAuthMiddleware((ctx) => {
    if (!isReviewSignInBody(ctx.body)) {
      return Promise.resolve();
    }

    const { returned } = ctx.context;
    if (isAPIError(returned)) {
      ctx.context.logger.warn(PLAY_REVIEW_LOG_LINES.signInFailed, { reason: returned.body?.code });
    } else {
      ctx.context.logger.info(PLAY_REVIEW_LOG_LINES.signInSucceeded);
    }

    return Promise.resolve();
  });

  return {
    ...plugin,
    endpoints,
    hooks: {
      ...declaredHooks,
      before: [
        ...(declaredHooks.before ?? []),
        { matcher: isSignInPath, handler: capReviewSignIn },
        { matcher: isNewSignInMethodPath, handler: refuseNewSignInMethod },
      ],
      after: [...(declaredHooks.after ?? []), { matcher: isSignInPath, handler: logReviewSignIn }],
    },
  };
}
