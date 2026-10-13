import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "~/env";
import { contentfulConfig } from "~/lib/contentful";

interface ParsedRequestUrl {
  origin: string;
  host: string;
  path: string;
  bypassToken: string;
  contentfulPreviewSecret: string;
}

const parseRequestUrl = (requestUrl: string | undefined): ParsedRequestUrl => {
  if (!requestUrl) throw new Error("missing `url` value in request");
  const { searchParams, origin, host } = new URL(requestUrl);

  const rawPath = searchParams.get("path") ?? "";
  const bypassToken = searchParams.get("x-vercel-protection-bypass") ?? "";
  const contentfulPreviewSecret = searchParams.get("x-contentful-preview-secret") ?? "";

  // to allow query parameters to be passed through to the redirected URL, the original `path` should already be
  // URI encoded, and thus must be decoded here
  const path = decodeURIComponent(rawPath);

  return { origin, path, host, bypassToken, contentfulPreviewSecret };
};

const buildRedirectUrl = ({
  path,
  base,
  bypassTokenFromQuery,
}: {
  path: string;
  base: string;
  bypassTokenFromQuery?: string;
}): string => {
  const redirectUrl = new URL(path, base);

  // if the bypass token is provided in the query, we assume Vercel has _not_ already set the actual
  // token that bypasses authentication. thus we provided it here, on the redirect
  if (bypassTokenFromQuery) {
    redirectUrl.searchParams.set("x-vercel-protection-bypass", bypassTokenFromQuery);
    redirectUrl.searchParams.set("x-vercel-set-bypass-cookie", "samesitenone");
  }

  return redirectUrl.toString();
};

async function hasValidPreviewSecret(provided: string): Promise<boolean> {
  const expected = Buffer.from((await contentfulConfig).previewSecret);
  const actual = Buffer.from(provided);

  // An unset secret must not turn into "anyone may preview".
  if (expected.length === 0 || expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

async function enableDraftMode() {
  (await draftMode()).enable();
  const store = await cookies();
  const cookie = store.get("__prerender_bypass");
  if (!cookie) {
    throw new Error("Missing '__prerender_bypass' cookie");
  }
  store.set({
    name: "__prerender_bypass",
    value: cookie.value,
    httpOnly: true,
    path: "/",
    secure: true,
    sameSite: "none",
  });
}

export async function GET(request: NextRequest): Promise<Response | void> {
  const {
    origin: base,
    path,
    bypassToken: bypassTokenFromQuery,
    contentfulPreviewSecret,
  } = parseRequestUrl(request.url);

  const staysOnSite = new URL(path, base).origin === base;
  if (!staysOnSite) {
    return new Response("Query parameter `path` must point to this site", { status: 400 });
  }

  // if we're in development, we don't need to check, we can just enable draft mode
  if (env.NODE_ENV === "development") {
    await enableDraftMode();
    const redirectUrl = buildRedirectUrl({ path, base, bypassTokenFromQuery });
    return redirect(redirectUrl);
  }

  if (!path) {
    return new Response("Missing required value for query parameter `path`", {
      status: 400,
    });
  }

  if (!(await hasValidPreviewSecret(contentfulPreviewSecret))) {
    return new Response("Invalid preview secret", { status: 401 });
  }

  await enableDraftMode();

  const redirectUrl = buildRedirectUrl({
    path,
    base,
    bypassTokenFromQuery,
  });
  redirect(redirectUrl);
}
