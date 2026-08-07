import { describe, expect, it } from "vitest";

import type { Visibility } from "./visibility-transition";
import { resolveVisibilityTransition } from "./visibility-transition";

describe("resolveVisibilityTransition", () => {
  // The full doc-010 transition matrix. `changed` is only true for the one
  // real state change (private → public); same-state cells are allowed no-ops.
  const cases: {
    from: Visibility;
    to: Visibility;
    allowed: boolean;
    changed?: boolean;
  }[] = [
    { from: "private", to: "public", allowed: true, changed: true },
    { from: "private", to: "private", allowed: true, changed: false },
    { from: "public", to: "public", allowed: true, changed: false },
    { from: "public", to: "private", allowed: false },
  ];

  it.each(cases)("$from → $to is allowed=$allowed", ({ from, to, allowed, changed }) => {
    const result = resolveVisibilityTransition(from, to);

    if (allowed) {
      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.value.changed).toBe(changed);
      }
    } else {
      expect(result.isFailure()).toBe(true);
      if (result.isFailure()) {
        expect(result.error.code).toBe("VISIBILITY_NOT_MONOTONIC");
      }
    }
  });

  it("rejects public → private for every caller (no privileged bypass)", () => {
    // There is no caller argument by design: the rule is caller-independent, so
    // owners/admins/cron all hit the same rejection.
    const result = resolveVisibilityTransition("public", "private");
    expect(result.isFailure()).toBe(true);
  });
});
