import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";

export function GET(request: NextRequest) {
  const useSecureCookies = env.NODE_ENV === "production";
  const cookiePrefix = useSecureCookies ? "__Secure-" : "";
  const environmentPrefix = env.ENVIRONMENT_PREFIX;
  const sessionCookieName = `${cookiePrefix}authjs.${environmentPrefix}.session-token`;

  const sessionToken = request.cookies.get(sessionCookieName)?.value;
  if (!sessionToken) {
    return new NextResponse("Invalid request: missing session token", {
      status: 400,
    });
  }

  const redirectUrl = `photosynq://callback?session_token=${encodeURIComponent(sessionToken)}`;
  return NextResponse.redirect(redirectUrl);
}
