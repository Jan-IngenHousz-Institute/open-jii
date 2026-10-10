import type { Page } from "@playwright/test";

import { dismissCookieBanner } from "./helpers.js";

/**
 * Development-only overlays that are not part of the product. Suppressing them
 * is not retouching: a production build renders none of them, and the
 * alternative is an image with the Next.js and TanStack Query badges in it.
 */
const DEV_CHROME_CSS = `
  nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button],
  .tsqd-open-btn-container, .tsqd-parent-container { display: none !important; }
`;

/** Animations mid-flight make stills non-reproducible. Never applied to video. */
const STILLNESS_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
`;

/** Clears what a capture must not show and fixes the theme, before and after a shot's own setup. */
export async function preparePage(
  page: Page,
  theme: "light" | "dark",
  freeze: boolean,
): Promise<void> {
  await page.addStyleTag({ content: DEV_CHROME_CSS });
  if (freeze) await page.addStyleTag({ content: STILLNESS_CSS });
  await dismissCookieBanner(page);
  const passkeyPromptDismissal = page.getByRole("button", { name: "Not now" });
  if (await passkeyPromptDismissal.isVisible().catch(() => false)) {
    await passkeyPromptDismissal.click();
    await passkeyPromptDismissal.waitFor({ state: "hidden" });
  }
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.waitForTimeout(400);
}
