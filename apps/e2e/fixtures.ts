import { expect as baseExpect, test as base } from "@playwright/test";

import type { ExpectedHttpFailure } from "./expected-noise.js";
import { watchForUnexpectedBrowserErrors } from "./expected-noise.js";

export const test = base.extend<{
  browserErrorGuard: void;
  expectedHttpFailures: ExpectedHttpFailure[];
}>({
  expectedHttpFailures: [[], { option: true }],
  browserErrorGuard: [
    async ({ page, expectedHttpFailures }, use) => {
      const watcher = watchForUnexpectedBrowserErrors(page, expectedHttpFailures);
      await use();
      baseExpect(watcher.stop(), "unexpected browser errors").toEqual([]);
    },
    { auto: true },
  ],
});

export const expect = baseExpect;
