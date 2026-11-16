"use server";

import { revalidatePath } from "next/cache";

/**
 * Call this after sign-in, sign-out or registration. Only a revalidation makes Next drop the pages
 * and redirects the browser prefetched for the previous session; `refresh()` refetches the current
 * route alone. The platform layout covers every page that reads the session, and no public page
 * shares it, so no cached public page is regenerated.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function revalidateAuth() {
  revalidatePath("/[locale]/platform", "layout");
}
