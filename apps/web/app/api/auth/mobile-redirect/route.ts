import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const sessionToken = request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken) {
    return new NextResponse("Invalid request: missing session token", {
      status: 400,
    });
  }

  const redirectUrl = `photosynq://callback?session_token=${encodeURIComponent(sessionToken)}`;
  return NextResponse.redirect(redirectUrl);
}
