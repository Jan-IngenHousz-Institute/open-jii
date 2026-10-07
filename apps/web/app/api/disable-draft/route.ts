import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

/** Ends a preview session; without it the draft cookie outlives the editor's visit. */
export async function GET(request: NextRequest): Promise<Response | void> {
  const { searchParams, origin } = new URL(request.url);
  const target = new URL(searchParams.get("path") ?? "/", origin);

  if (target.origin !== origin) {
    return new Response("Query parameter `path` must point to this site", { status: 400 });
  }

  (await draftMode()).disable();
  redirect(target.toString());
}
