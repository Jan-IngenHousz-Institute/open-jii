// middleware.ts (or src/middleware.ts)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // clone incoming headers and add our own
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-path", request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
export const config = {
  matcher: "/openjii/:path*",
};
