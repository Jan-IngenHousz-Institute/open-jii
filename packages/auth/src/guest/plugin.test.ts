import { fromPartial } from "@total-typescript/shoehorn";
import type * as AuthApi from "better-auth/api";
import { getSessionFromCtx } from "better-auth/api";
import type * as AuthCookies from "better-auth/cookies";
import { expireCookie } from "better-auth/cookies";
import type * as AuthPlugins from "better-auth/plugins";
import { anonymous } from "better-auth/plugins";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isDemoModeEnabled } from "@repo/analytics/server";

import { demoModeEnabled, openJiiGuest } from "./plugin";
import { isGuestRecipient } from "./recipient";

vi.mock("better-auth/api", async (original) => ({
  ...(await original<typeof AuthApi>()),
  getSessionFromCtx: vi.fn(),
}));
vi.mock("better-auth/cookies", async (original) => ({
  ...(await original<typeof AuthCookies>()),
  expireCookie: vi.fn(),
}));
vi.mock("better-auth/plugins", async (original) => {
  const actual = await original<typeof AuthPlugins>();
  return { ...actual, anonymous: vi.fn(actual.anonymous) };
});
vi.mock("@repo/analytics/server", () => ({ isDemoModeEnabled: vi.fn() }));
vi.mock("./recipient", () => ({ isGuestRecipient: vi.fn() }));

const guest = fromPartial<NonNullable<Awaited<ReturnType<typeof getSessionFromCtx>>>>({
  user: { id: "guest", isAnonymous: true },
});
const researcher = fromPartial<NonNullable<Awaited<ReturnType<typeof getSessionFromCtx>>>>({
  user: { id: "researcher", isAnonymous: false },
});
const plugin = () => openJiiGuest({ isDemoEnabled: () => Promise.resolve(true) });
const context = (path: string, body: unknown = {}) => {
  const _guard = plugin().hooks.before[0];
  return Object.assign(fromPartial<Parameters<typeof _guard.handler>[0]>({}), {
    path,
    body,
    context: { session: guest },
    query: {},
  });
};
const before = (path: string, body?: unknown) =>
  plugin().hooks.before[0].handler(context(path, body));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromCtx).mockResolvedValue(null);
  vi.mocked(isGuestRecipient).mockResolvedValue(false);
});

describe("guest auth boundary", () => {
  it("uses the server demo flag and preserves anonymous plugin name generation", async () => {
    vi.mocked(isDemoModeEnabled).mockResolvedValue(true);
    expect(await demoModeEnabled()).toBe(true);
    openJiiGuest();
    const options = vi.mocked(anonymous).mock.calls.slice(-1)[0]?.[0];
    expect(options).toMatchObject({ disableDeleteAnonymousUser: true });
    const generate = options?.generateName;
    expect(generate).toBeTypeOf("function");
    if (!generate) throw new Error("missing name generator");
    expect(
      await generate(fromPartial<Parameters<typeof generate>[0]>({ body: { name: "  Ada  " } })),
    ).toBe("Ada");
    expect(await generate(fromPartial<Parameters<typeof generate>[0]>({ body: null }))).toBe(
      "Guest",
    );
    expect(await before("/sign-in/anonymous", [])).toBeUndefined();
    await expect(
      before("/sign-in/anonymous", { name: "https://example.com" }),
    ).rejects.toMatchObject({
      status: "BAD_REQUEST",
      body: { code: "INVALID_GUEST_NAME" },
    });
  });

  it("refuses reserved recipients before dispatch, but leaves ordinary researchers alone", async () => {
    vi.mocked(isGuestRecipient).mockResolvedValue(true);
    await expect(before("/sign-in/email", { email: "guest@example.com" })).rejects.toMatchObject({
      status: "FORBIDDEN",
    });
    vi.mocked(isGuestRecipient).mockResolvedValue(false);
    vi.mocked(getSessionFromCtx).mockResolvedValue(researcher);
    expect(await before("/update-user", { name: "Researcher" })).toBeUndefined();
  });

  it("allows anonymous re-entry, refuses researcher replacement and checks availability for new sessions", async () => {
    vi.mocked(getSessionFromCtx).mockResolvedValue(guest);
    expect(await before("/sign-in/anonymous")).toBeUndefined();
    vi.mocked(getSessionFromCtx).mockResolvedValue(researcher);
    await expect(before("/sign-in/anonymous")).rejects.toMatchObject({ status: "FORBIDDEN" });
    vi.mocked(getSessionFromCtx).mockResolvedValue(null);
    await expect(
      openJiiGuest({ isDemoEnabled: () => Promise.resolve(false) }).hooks.before[0].handler(
        context("/sign-in/anonymous"),
      ),
    ).rejects.toMatchObject({ body: { code: "DEMO_DISABLED" } });
    vi.mocked(isDemoModeEnabled).mockResolvedValue(true);
    expect(
      await openJiiGuest().hooks.before[0].handler(context("/sign-in/anonymous")),
    ).toBeUndefined();
  });

  it("bypasses the guest cookie cache and refuses an already purged guest update", async () => {
    vi.mocked(getSessionFromCtx).mockResolvedValue(guest);
    const ctx = context("/get-session");
    ctx.query = { fresh: "yes" };
    expect(await plugin().hooks.before[0].handler(ctx)).toEqual({
      context: { query: { fresh: "yes", disableCookieCache: true } },
    });
    expect(ctx.context.session).toBeNull();
    vi.mocked(getSessionFromCtx).mockResolvedValueOnce(guest).mockResolvedValueOnce(null);
    await expect(before("/update-user", { name: "Ada" })).rejects.toMatchObject({
      status: "UNAUTHORIZED",
    });
    expect(getSessionFromCtx).toHaveBeenLastCalledWith(expect.anything(), {
      disableCookieCache: true,
    });
  });

  it("permits sign-out and validated name-only changes, while refusing other guest actions", async () => {
    vi.mocked(getSessionFromCtx).mockResolvedValue(guest);
    expect(await before("/sign-out")).toBeUndefined();
    expect(await before("/update-user", { name: "  Ada  " })).toEqual({
      context: { body: { name: "Ada" } },
    });
    await expect(before("/update-user", { email: "a@example.com" })).rejects.toMatchObject({
      status: "FORBIDDEN",
    });
    await expect(before("/update-user", { name: "Ada", image: "image" })).rejects.toMatchObject({
      status: "FORBIDDEN",
    });
    await expect(before("/organization/create")).rejects.toMatchObject({
      body: { code: "GUEST_ACTION_FORBIDDEN" },
    });
    expect(plugin().hooks.before[0].matcher()).toBe(true);
  });
});

describe("guest response privacy", () => {
  function afterContext(returned: unknown, path = "/sign-in/anonymous") {
    const _guard = plugin().hooks.after.slice(-1)[0];
    const responseHeaders: Headers | undefined = new Headers({
      "set-cookie": "session_data.1=new; Path=/",
    });
    return Object.assign(
      fromPartial<Parameters<typeof _guard.handler>[0]>({
        request: new Request("http://localhost/auth"),
        headers: new Headers({ cookie: "session_data.0=old; unrelated=value" }),
      }),
      {
        path,
        context: {
          returned,
          session: guest,
          authCookies: { sessionData: { name: "session_data", attributes: { path: "/" } } },
          responseHeaders,
        },
      },
    );
  }
  it("expires cookie cache chunks and strips guest email from a sign-in response", async () => {
    const guard = plugin().hooks.after.slice(-1)[0];
    expect(guard.matcher(fromPartial<Parameters<typeof guard.matcher>[0]>({}))).toBe(true);
    const ctx = afterContext({
      user: { id: "guest", isAnonymous: true, email: "hidden" },
      token: "signed",
    });
    await guard.handler(ctx);
    expect(ctx.context.returned).toEqual({
      user: { id: "guest", isAnonymous: true },
      token: "signed",
    });
    expect(
      vi
        .mocked(expireCookie)
        .mock.calls.map(([, cookie]) => cookie.name)
        .sort(),
    ).toEqual(["session_data", "session_data.0", "session_data.1"]);
  });
  it("expires cached identity on name updates without changing the response shape", async () => {
    const ctx = afterContext({ status: true }, "/update-user");
    const withoutCache = {
      ...ctx,
      headers: undefined,
      context: { ...ctx.context, responseHeaders: undefined },
    };
    await plugin().hooks.after.slice(-1)[0].handler(withoutCache);
    expect(withoutCache.context.returned).toEqual({ status: true });
    expect(expireCookie).toHaveBeenCalledTimes(1);
  });
  it("ignores absent requests, non-user responses and researchers", async () => {
    const guard = plugin().hooks.after.slice(-1)[0];
    const ctx = afterContext({ user: guest.user });
    ctx.request = undefined;
    await guard.handler(ctx);
    for (const returned of [
      null,
      "error",
      {},
      { user: null },
      { user: "wrong" },
      { user: {} },
      { user: researcher.user },
    ])
      await guard.handler(afterContext(returned));
    expect(expireCookie).not.toHaveBeenCalled();
  });
});
