import { AppError } from "../common/utils/fp-utils";

type Visibility = "private" | "public";

/**
 * Visibility is monotonic: a resource may go private → public, but once public it
 * can never be made private again (published data must stay published — this also
 * matches the experiment embargo, which only ever flips private → public).
 * Returns an AppError when the transition is disallowed, otherwise null.
 */
export function assertMonotonicVisibility(
  current: Visibility | null | undefined,
  next: Visibility | null | undefined,
): AppError | null {
  if (current === "public" && next === "private") {
    return AppError.badRequest(
      "A public resource cannot be made private again.",
      "VISIBILITY_TRANSITION_FORBIDDEN",
    );
  }
  return null;
}
