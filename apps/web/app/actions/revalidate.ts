"use server";

import { revalidatePath } from "next/cache";

/**
 * Server action to invalidate auth-related caches
 * Call this after login/logout to force re-rendering of protected pages. From the locale layout
 * down, since it decides the viewer's language by their feature flags.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function revalidateAuth() {
  revalidatePath("/[locale]", "layout");
}
