import { describe, expect, it, vi } from "vitest";

import { setConsentStatus, subscribeToConsentStatus } from "./cookie-consent";

describe("subscribeToConsentStatus", () => {
  it("tells subscribers about a choice", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToConsentStatus(onChange);

    setConsentStatus("accepted");

    expect(onChange).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("stops telling a subscriber once it unsubscribes", () => {
    const onChange = vi.fn();
    subscribeToConsentStatus(onChange)();

    setConsentStatus("accepted");

    expect(onChange).not.toHaveBeenCalled();
  });
});
