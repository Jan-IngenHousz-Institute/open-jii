import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "~/env";

const BACKEND_URL = env.NEXT_PUBLIC_API_URL;

/**
 * Proxy all auth requests to the backend
 * Better Auth is now handled entirely by the NestJS backend
 */
async function handleAuth(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace("/api/auth", "");
  const searchParams = request.nextUrl.searchParams.toString();
  const backendUrl = `${BACKEND_URL}/auth${pathname}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Forward cookies
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const init: RequestInit = {
      method: request.method,
      headers,
      credentials: "include",
    };

    // Add body for non-GET requests
    if (request.method !== "GET" && request.method !== "HEAD") {
      const body = await request.text();
      if (body) {
        init.body = body;
      }
    }

    const response = await fetch(backendUrl, init);

    // Forward the response from backend
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    const responseBody = await response.text();

    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Auth proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = handleAuth;
export const POST = handleAuth;
export const PUT = handleAuth;
export const DELETE = handleAuth;
export const PATCH = handleAuth;
