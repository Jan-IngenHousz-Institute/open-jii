"use server";

import { revalidatePath } from "next/cache";

/**
 * Server action to invalidate auth-related caches
 * Call this after login/logout to force re-rendering of protected pages
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function revalidateAuth() {
  revalidatePath("/[locale]/platform", "layout");
}
