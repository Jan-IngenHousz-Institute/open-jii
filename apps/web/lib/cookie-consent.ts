/**
 * Cookie consent state management
 * Handles storing and retrieving user consent preferences for analytics cookies
 */
import type { PostHog } from "posthog-js";

export type ConsentStatus = "pending" | "accepted" | "rejected";

const CONSENT_COOKIE_NAME = "jii_cookie_consent";
const CONSENT_EXPIRY_DAYS = 365; // 1 year
const CONSENT_CHANGE_EVENT = "jii-cookie-consent-change";
// A cookie change fires no event in other tabs, so each choice is also announced across tabs.
const CONSENT_CHANNEL = "jii-cookie-consent";

/**
 * Get the current consent status from the cookie
 */
export function getConsentStatus(): ConsentStatus {
  if (typeof document === "undefined") {
    return "pending";
  }

  const cookies = document.cookie.split(";");
  const consentCookie = cookies.find((cookie) =>
    cookie.trim().startsWith(`${CONSENT_COOKIE_NAME}=`),
  );

  if (!consentCookie) {
    return "pending";
  }

  const value = consentCookie.split("=")[1];
  if (value === "accepted" || value === "rejected") {
    return value;
  }

  return "pending";
}

/**
 * Set the consent status in a cookie
 */
export function setConsentStatus(status: "accepted" | "rejected"): void {
  if (typeof document === "undefined") {
    return;
  }

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + CONSENT_EXPIRY_DAYS);

  document.cookie = `${CONSENT_COOKIE_NAME}=${status}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax; Secure`;
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));

  const channel = new BroadcastChannel(CONSENT_CHANNEL);
  channel.postMessage(status);
  channel.close();
}

/**
 * Record a visitor's analytics choice and apply it to PostHog at once. PostHog picks its
 * persistence when it starts, memory only until consent, so a choice made during a visit switches
 * it too: without the switch, the identity used after accepting is lost on the next page load.
 */
export function setAnalyticsConsent(
  posthog: PostHog | null,
  status: "accepted" | "rejected",
): void {
  setConsentStatus(status);

  if (status === "accepted") {
    posthog?.set_config({ persistence: "localStorage+cookie" });
    posthog?.opt_in_capturing();
    return;
  }

  posthog?.opt_out_capturing();
  posthog?.reset();
  posthog?.set_config({ persistence: "memory" });
}

/**
 * Subscribe to changes made through setConsentStatus, in this tab or another, in the shape
 * useSyncExternalStore takes
 */
export function subscribeToConsentStatus(onChange: () => void): () => void {
  const channel = new BroadcastChannel(CONSENT_CHANNEL);
  channel.addEventListener("message", onChange);
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    channel.close();
  };
}
