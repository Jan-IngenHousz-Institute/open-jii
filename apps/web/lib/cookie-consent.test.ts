import posthog from "posthog-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getConsentStatus,
  setAnalyticsConsent,
  setConsentStatus,
  subscribeToConsentStatus,
} from "./cookie-consent";

describe("setAnalyticsConsent", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("moves PostHog to cookie persistence before it starts capturing, so the identity outlives the page", () => {
    setAnalyticsConsent(posthog, "accepted");

    expect(posthog.set_config).toHaveBeenCalledWith({ persistence: "localStorage+cookie" });
    expect(vi.mocked(posthog.set_config).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(posthog.opt_in_capturing).mock.invocationCallOrder[0],
    );
  });

  it("stops capturing, forgets the visitor and keeps nothing beyond the page on rejection", () => {
    setAnalyticsConsent(posthog, "rejected");

    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    expect(posthog.reset).toHaveBeenCalled();
    expect(posthog.set_config).toHaveBeenCalledWith({ persistence: "memory" });
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
  });

  it("still records the choice before PostHog has loaded", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToConsentStatus(onChange);

    setAnalyticsConsent(null, "accepted");

    expect(onChange).toHaveBeenCalledOnce();
    expect(posthog.set_config).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("subscribeToConsentStatus", () => {
  afterEach(() => {
    document.cookie = "jii_cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("tells subscribers about a choice", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToConsentStatus(onChange);

    setConsentStatus("accepted");

    expect(onChange).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("lets a subscriber read a choice made in another tab", async () => {
    const seen: string[] = [];
    const unsubscribe = subscribeToConsentStatus(() => {
      seen.push(getConsentStatus());
    });
    const otherTab = new BroadcastChannel("jii-cookie-consent");

    // The tabs share the cookie; the other tab writes it, then announces the change.
    document.cookie = "jii_cookie_consent=rejected; path=/";
    otherTab.postMessage("rejected");

    await vi.waitFor(() => {
      expect(seen).toEqual(["rejected"]);
    });
    otherTab.close();
    unsubscribe();
  });

  it("stops telling a subscriber once it unsubscribes", () => {
    const onChange = vi.fn();
    subscribeToConsentStatus(onChange)();

    setConsentStatus("accepted");

    expect(onChange).not.toHaveBeenCalled();
  });
});
