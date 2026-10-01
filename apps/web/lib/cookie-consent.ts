/**
 * Cookie consent state management
 * Handles storing and retrieving user consent preferences for analytics cookies
 */

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
