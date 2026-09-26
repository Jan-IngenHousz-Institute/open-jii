import { createMyOrganization, createSession } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import posthog from "posthog-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { setConsentStatus } from "../lib/cookie-consent";
import { usePostHogAuth } from "./usePostHogAuth";

const session = createSession({ user: { id: "user-ana", email: "ana@example.com", name: "Ana" } });
const flagProperties = { email: "ana@example.com", organization_ids: "org-qa,org-lab" };

// jsdom serves http, where the Secure consent cookie cannot be stored, so read it as an https
// browser would and let setConsentStatus announce the change.
function storeConsent(status: "accepted" | "rejected") {
  return vi.spyOn(document, "cookie", "get").mockReturnValue(`jii_cookie_consent=${status}`);
}

function mockSession(data: typeof session | null, isPending = false) {
  vi.mocked(useSession).mockReturnValue({
    data,
    isPending,
    isRefetching: false,
    error: null,
    refetch: vi.fn(),
  });
}

describe("usePostHogAuth", () => {
  let storedConsent: MockInstance | undefined;

  beforeEach(() => {
    server.mount(contract.organizations.listMyOrganizations, {
      body: [createMyOrganization({ id: "org-qa" }), createMyOrganization({ id: "org-lab" })],
    });
  });

  afterEach(() => {
    mockSession(null);
    vi.mocked(posthog.get_property).mockReset();
    storedConsent?.mockRestore();
  });

  it("gives flag evaluations the email and memberships without identifying before consent", async () => {
    mockSession(session);

    renderHook(() => usePostHogAuth());

    await waitFor(() => {
      expect(posthog.setPersonPropertiesForFlags).toHaveBeenCalledWith(flagProperties, true);
    });
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.setPersonProperties).not.toHaveBeenCalled();
  });

  it("identifies the user and restores the flag properties once they accept cookies", async () => {
    mockSession(session);
    renderHook(() => usePostHogAuth());
    await waitFor(() => {
      expect(posthog.setPersonPropertiesForFlags).toHaveBeenCalledOnce();
    });

    storedConsent = storeConsent("accepted");
    act(() => {
      setConsentStatus("accepted");
    });

    await waitFor(() => {
      expect(posthog.identify).toHaveBeenCalledWith("ana@example.com", {
        email: "ana@example.com",
        name: "Ana",
      });
    });
    expect(posthog.setPersonPropertiesForFlags).toHaveBeenCalledTimes(2);
    expect(posthog.setPersonProperties).toHaveBeenCalledWith(flagProperties);
  });

  it("restores the flag properties after the user rejects cookies", async () => {
    mockSession(session);
    renderHook(() => usePostHogAuth());
    await waitFor(() => {
      expect(posthog.setPersonPropertiesForFlags).toHaveBeenCalledOnce();
    });

    storedConsent = storeConsent("rejected");
    act(() => {
      setConsentStatus("rejected");
    });

    await waitFor(() => {
      expect(posthog.setPersonPropertiesForFlags).toHaveBeenCalledTimes(2);
    });
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.setPersonProperties).not.toHaveBeenCalled();
  });

  it("still sends the email when the memberships cannot be loaded", async () => {
    server.mount(contract.organizations.listMyOrganizations, { status: 500 });
    mockSession(session);

    renderHook(() => usePostHogAuth());

    await waitFor(() => {
      expect(posthog.setPersonPropertiesForFlags).toHaveBeenCalledWith(
        { email: "ana@example.com", organization_ids: "" },
        true,
      );
    });
  });

  it("leaves PostHog alone while the session is loading", () => {
    mockSession(null, true);
    vi.mocked(posthog.get_property).mockReturnValue("identified");

    renderHook(() => usePostHogAuth());

    expect(posthog.reset).not.toHaveBeenCalled();
  });

  it("leaves an anonymous visitor's id alone", () => {
    vi.mocked(posthog.get_property).mockReturnValue("anonymous");

    renderHook(() => usePostHogAuth());

    expect(posthog.reset).not.toHaveBeenCalled();
  });

  it("resets PostHog when it still holds a user who is now signed out", () => {
    vi.mocked(posthog.get_property).mockReturnValue("identified");

    renderHook(() => usePostHogAuth());

    expect(posthog.reset).toHaveBeenCalledOnce();
  });

  it("clears the flag properties when a user signs out before consenting", async () => {
    mockSession(session);
    const { rerender } = renderHook(() => usePostHogAuth());
    await waitFor(() => {
      expect(posthog.setPersonPropertiesForFlags).toHaveBeenCalledOnce();
    });

    mockSession(null);
    rerender();

    expect(posthog.reset).toHaveBeenCalledOnce();
  });
});
