import { AppError, failure, success } from "../../common/utils/fp-utils";
import type { Result } from "../../common/utils/fp-utils";

/** Two-value visibility shared by every org-scoped resource type. */
export type Visibility = "private" | "public";

/**
 * The **sole** implementation of the monotonic visibility rule: `private → public`
 * publishes, same-state is a no-op, and `public → private` is rejected for every
 * caller (owners, admins and the embargo cron alike).
 *
 * Every write path that can change visibility routes through here, so the rule has
 * exactly one home. Returns `{ changed }` so callers can skip a redundant write.
 */
export function resolveVisibilityTransition(
  current: Visibility,
  target: Visibility,
): Result<{ changed: boolean }> {
  if (current === target) {
    return success({ changed: false });
  }
  if (current === "public" && target === "private") {
    return failure(
      AppError.badRequest(
        "Visibility is one-way: a public resource cannot be made private again",
        "VISIBILITY_NOT_MONOTONIC",
      ),
    );
  }
  // Only `private → public` remains.
  return success({ changed: true });
}
