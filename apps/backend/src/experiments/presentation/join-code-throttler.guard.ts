import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

interface ThrottledRequest {
  session?: { user?: { id?: string } };
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}

/**
 * Keys the throttle on the signed-in user. Both routes require a session, so the
 * user id is the honest bucket: sharing an office IP must not make one participant's
 * scan exhaust everyone else's, and a rotating IP must not mint fresh buckets.
 *
 * The forwarded-for fallback is the newsletter guard's, for the window between the
 * guard running and a session being attached.
 */
@Injectable()
export class JoinCodeThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: ThrottledRequest): Promise<string> {
    const userId = req.session?.user?.id;
    if (userId) {
      return Promise.resolve(userId);
    }

    const header = req.headers?.["x-forwarded-for"];
    const raw = Array.isArray(header) ? header.join(",") : header;
    const chain = (raw ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (chain.length >= 2) {
      return Promise.resolve(chain[chain.length - 2]);
    }
    if (chain.length === 1) {
      return Promise.resolve(chain[0]);
    }
    return Promise.resolve(req.ip ?? "");
  }
}
