import { afterEach, describe, expect, it, vi } from "vitest";

import { getConsentStatus, setConsentStatus, subscribeToConsentStatus } from "./cookie-consent";

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
