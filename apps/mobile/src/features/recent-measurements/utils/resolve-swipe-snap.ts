/**
 * Where a released swipe should settle: velocity decides a flick, otherwise the
 * halfway point decides. Pure so the rule is testable without a gesture.
 *
 * Carries the "worklet" directive because the pan handler that calls it runs on
 * the UI runtime, which cannot call a plain JS function synchronously. Still an
 * ordinary function from the JS side, so tests call it directly.
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
  "worklet";
  const FLICK_VELOCITY = 150;
  // Nothing to reveal (a row with no actions, or a layer not measured yet).
  if (actionWidth <= 0) return 0;
  if (velocityX > FLICK_VELOCITY) return 0;
  if (velocityX < -FLICK_VELOCITY) return -actionWidth;
  return translateX < -actionWidth / 2 ? -actionWidth : 0;
}
