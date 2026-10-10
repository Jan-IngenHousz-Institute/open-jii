import type { NextRequest } from "next/server";
import { fetchWebReleaseNotes } from "~/components/whats-new/fetch-release-notes";

import { isKnownLocale } from "@repo/i18n";

/** The What's new notes, fetched when the sheet opens instead of being embedded in every page. */
export async function GET(request: NextRequest): Promise<Response> {
  const locale = request.nextUrl.searchParams.get("locale") ?? "";

  if (!isKnownLocale(locale)) {
    return new Response("Query parameter `locale` must be a supported locale", { status: 400 });
  }

  const notes = await fetchWebReleaseNotes(locale);

  return Response.json(notes, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" },
  });
}
