import type { Page } from "@playwright/test";

/** Installed on the page before it loads, to answer some of its requests the way a shot needs. */
export interface Fixture {
  install(page: Page): Promise<void>;
}

/** An id as written, or looked up by name when the shot runs, since seeded ids change on reseed. */
export type Resolvable = string | (() => Promise<string>);

export async function resolve(value: Resolvable): Promise<string> {
  return typeof value === "string" ? value : value();
}
