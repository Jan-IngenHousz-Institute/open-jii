import { GUEST_LIFETIME_MS } from "@repo/api/shared/guest";

const CLOCK_TOLERANCE = 2 * 60 * 1000;

export function guestLifetime(createdAt: unknown, now: number, highWater: number) {
  const created =
    typeof createdAt === "string" || createdAt instanceof Date
      ? new Date(createdAt).getTime()
      : NaN;
  const latest = Math.max(now, highWater);
  return {
    valid:
      Number.isFinite(created) &&
      created <= now + CLOCK_TOLERANCE &&
      now >= highWater - CLOCK_TOLERANCE &&
      latest < created + GUEST_LIFETIME_MS,
    highWater: latest,
  };
}
