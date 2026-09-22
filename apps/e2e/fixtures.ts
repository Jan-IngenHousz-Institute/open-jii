import { expect as baseExpect, test as base } from "@playwright/test";

import { watchForUnexpectedBrowserErrors } from "./expected-noise.js";

export const test = base.extend<{ browserErrorGuard: void }>({
  browserErrorGuard: [
    async ({ page }, use) => {
      const watcher = watchForUnexpectedBrowserErrors(page);
      await use();
      baseExpect(watcher.stop(), "unexpected browser errors").toEqual([]);
    },
    { auto: true },
  ],
});

export const expect = baseExpect;
