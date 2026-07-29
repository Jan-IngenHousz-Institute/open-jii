import { AppError, failure, success } from "../common/utils/fp-utils";
import type { Result } from "../common/utils/fp-utils";

/** Two-value visibility shared by every org-scoped resource type. */
export type Visibility = "private" | "public";

/**
 * The **sole** implementation of the monotonic visibility rule. Every
 * write path that can change a resource's visibility — the `setVisibility`
 * use-case and the embargo cron — routes through here so the rule has exactly
 * one home.
 *
 * Allowed transitions:
 * - `private → public` — publish (the one real change).
 * - `private → private` / `public → public` — same-state no-ops.
 *
 * Rejected for **every** caller (owners, admins, and the automated embargo
 * cron alike):
 * - `public → private` — visibility is one-way; a published resource stays
 *   published.
 *
 * Returns `{ changed }` so callers can skip a redundant write on a no-op.
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
