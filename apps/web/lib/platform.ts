"use client";

/**
 * True when the user agent reports a Mac/iOS device. Used to show the right
 * modifier glyph (⌘ on Apple, Ctrl on everything else) in keyboard hints.
 * Safe to call during SSR — returns false on the server.
 */
export function isMac(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /Mac|iPhone|iPad|iPod/.test(window.navigator.platform) || ua.includes("Macintosh");
}

/** "⌘" on Mac, "Ctrl" everywhere else. */
export function modifierLabel(): string {
  return isMac() ? "⌘" : "Ctrl";
}

/** True inside the openJII desktop app, which adds `openJII-Desktop/<version>` to its user agent. */
export function isDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  return window.navigator.userAgent.includes("openJII-Desktop/");
}
