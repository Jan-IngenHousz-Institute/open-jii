import { NextResponse } from "next/server";
import type { NextMiddleware } from "next/server";

import { middleware } from "@repo/auth/next";

export default middleware((request) => {
  if (!request.auth) {
    const callbackUrl = encodeURIComponent(
      `${request.nextUrl.origin}${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    const newUrl = new URL(
      `/api/auth/signin?callbackUrl=${callbackUrl}`,
      request.nextUrl.origin,
    );
    return Response.redirect(newUrl);
  }

  // Clone incoming headers and add our own
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-path", request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}) as NextMiddleware;

export const config = {
  matcher: "/openjii/:path*",
};
