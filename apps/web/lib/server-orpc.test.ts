import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServerOrpcClient } from "./server-orpc";

interface CapturedLinkOptions {
  url: string;
  headers: () => Record<string, string>;
}

// Capture every `new OpenAPILink(contract, options)` so we can assert exactly
// how the request is authenticated, without performing any real transport.
const linkConstructions = vi.hoisted(
  () => [] as { contract: unknown; options: CapturedLinkOptions }[],
);

vi.mock("@orpc/openapi-client/fetch", () => ({
  // Constructable (invoked via `new OpenAPILink(...)`), so use a function expression.
  OpenAPILink: vi.fn(function (this: unknown, contract: unknown, options: unknown) {
    linkConstructions.push({ contract, options: options as CapturedLinkOptions });
    return { __openApiLink: true };
  }),
}));

vi.mock("@orpc/client", () => ({
  createORPCClient: vi.fn((link: unknown) => ({ __client: true, link })),
  ORPCError: class ORPCError extends Error {},
}));

const cookieStore = vi.hoisted(() => ({ value: "" }));

// Override the global next/headers stub with one whose cookies().toString()
// we control per test.
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      toString: () => cookieStore.value,
    }),
  ),
}));

function latestOptions(): CapturedLinkOptions {
  const construction = linkConstructions.at(-1);
  if (!construction) throw new Error("OpenAPILink was not constructed");
  return construction.options;
}

function latestHeaders(): Record<string, string> {
  const { headers } = latestOptions();
  expect(typeof headers).toBe("function");
  return headers();
}

describe("createServerOrpcClient auth boundary", () => {
  beforeEach(() => {
    linkConstructions.length = 0;
    cookieStore.value = "";
    vi.clearAllMocks();
  });

  it("forwards the exact incoming cookies as the only cookie header, tagged with the app source", async () => {
    cookieStore.value = "session=secret-token; theme=dark";

    await createServerOrpcClient();

    expect(OpenAPILink).toHaveBeenCalledTimes(1);
    const headers = latestHeaders();
    // Exactly the app-source tag plus the verbatim incoming cookie: nothing more.
    expect(headers).toEqual({
      "x-app-source": "orpc",
      cookie: "session=secret-token; theme=dark",
    });
    // The cookie value is not smuggled into the request URL either.
    expect(latestOptions().url).not.toContain("secret-token");
  });

  it("omits the cookie header entirely when the request has no cookies", async () => {
    cookieStore.value = "";

    await createServerOrpcClient();

    const headers = latestHeaders();
    expect(headers).toEqual({ "x-app-source": "orpc" });
    expect(headers).not.toHaveProperty("cookie");
  });

  it("builds a fresh link per call and never logs the cookie value (no persistent cache)", async () => {
    const logSpies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "debug").mockImplementation(() => undefined),
    ];

    cookieStore.value = "session=secret-token";
    await createServerOrpcClient();
    await createServerOrpcClient();

    // A new link (and thus a fresh cookie read) on every call: the authenticated
    // client is not memoized across requests.
    expect(OpenAPILink).toHaveBeenCalledTimes(2);

    for (const spy of logSpies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain("secret-token");
      }
      spy.mockRestore();
    }
  });
});
