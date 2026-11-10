"use server";

import { refresh } from "next/cache";

/**
 * Call this after sign-in, sign-out or registration. It clears the browser's page cache, which
 * would otherwise replay pages and redirects prefetched for the previous session. The server's
 * cached pages read no session, so they stay.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function revalidateAuth() {
  refresh();
}
