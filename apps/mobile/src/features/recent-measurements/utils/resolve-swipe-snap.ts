/**
 * Where a released swipe should settle: velocity decides a flick, otherwise the
 * halfway point decides. Pure so the rule is testable without a gesture.
 */
export function resolveSwipeSnap({
  translateX,
  velocityX,
  actionWidth,
}: {
  /** Current offset, 0 closed and negative while open. */
  translateX: number;
  velocityX: number;
  /** Width of the revealed action layer. */
  actionWidth: number;
}): number {
  const FLICK_VELOCITY = 150;
  // Nothing to reveal (a row with no actions, or a layer not measured yet).
  if (actionWidth <= 0) return 0;
  if (velocityX > FLICK_VELOCITY) return 0;
  if (velocityX < -FLICK_VELOCITY) return -actionWidth;
  return translateX < -actionWidth / 2 ? -actionWidth : 0;
}
