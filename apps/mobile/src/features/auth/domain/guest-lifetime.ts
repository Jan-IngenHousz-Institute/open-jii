const LIFETIME = 7 * 24 * 60 * 60 * 1000;
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
      latest < created + LIFETIME,
    highWater: latest,
  };
}
