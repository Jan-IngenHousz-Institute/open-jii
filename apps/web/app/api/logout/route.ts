import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const backUrl = searchParams.get("backUrl") ?? "/";

  // Redirect to NextAuth's signout endpoint with callbackUrl
  // This will show the confirmation page and then redirect back
  const signOutUrl = new URL("/api/auth/signout", request.url);
  signOutUrl.searchParams.set("callbackUrl", backUrl);

  return NextResponse.redirect(signOutUrl);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { backUrl?: string };
  const backUrl = body.backUrl ?? "/";

  // For POST requests, construct the signout URL but don't redirect
  // Return it as JSON so the client can handle it
  const signOutUrl = new URL("/api/auth/signout", request.url);
  signOutUrl.searchParams.set("callbackUrl", backUrl);

  return NextResponse.json({
    success: true,
    signOutUrl: signOutUrl.toString(),
    message: "Use the signOutUrl to complete logout",
  });
}
