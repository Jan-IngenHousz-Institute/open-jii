import { NextResponse } from "next/server";
import type { NextMiddleware } from "next/server";

import { middleware } from "@repo/auth/next";

export default middleware((request) => {
  // Handle login page redirects - if user is logged in and trying to access login page
  if (request.nextUrl.pathname === "/login" && request.auth) {
    return NextResponse.redirect(new URL("/openjii", request.nextUrl.origin));
  }

  // Handle protected routes
  if (request.nextUrl.pathname.startsWith("/openjii") && !request.auth) {
    const callbackUrl = encodeURIComponent(
      `${request.nextUrl.origin}${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    const newUrl = new URL(
      `/api/auth/signin?=${callbackUrl}`,
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
  matcher: ["/openjii/:path*", "/login"],
};
