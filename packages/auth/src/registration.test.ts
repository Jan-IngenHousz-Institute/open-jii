import { describe, expect, it } from "vitest";

import { REGISTRATION_FIELD_ERROR, serverOwnedRegistration } from "./registration";

const guard = serverOwnedRegistration();
const request = (body: string) =>
  new Request("http://localhost/api/v1/auth/future", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

describe("server-owned registration request guard", () => {
  it.each([
    '{"registered":false}',
    '{"data":{"registered":null}}',
    '{"__proto__":{"registered":true}}',
    '{"nested":[{"registered":"false"}]}',
  ])("rejects raw client input %s", async (body) => {
    const result = await guard.onRequest(request(body));
    expect(result?.response.status).toBe(400);
    expect(await result?.response.json()).toEqual(REGISTRATION_FIELD_ERROR);
    expect(Object.prototype).not.toHaveProperty("registered");
  });

  it("does not consume an allowed request's body", async () => {
    const req = request('{"name":"Researcher"}');
    expect(await guard.onRequest(req)).toBeUndefined();
    expect(await req.json()).toEqual({ name: "Researcher" });
  });

  it.each(["urlencoded", "multipart"])("rejects registered in %s forms", async (encoding) => {
    const form = encoding === "urlencoded" ? new URLSearchParams() : new FormData();
    form.set("registered", "false");
    const req = new Request("http://localhost/api/v1/auth/future", { method: "POST", body: form });
    const result = await guard.onRequest(req);
    expect(result?.response.status).toBe(400);
    expect(await result?.response.json()).toEqual(REGISTRATION_FIELD_ERROR);
  });

  it("leaves malformed JSON to the router's validation", async () => {
    expect(await guard.onRequest(request("{"))).toBeUndefined();
  });

  it("leaves bodyless session reads unchanged", async () => {
    expect(
      await guard.onRequest(new Request("http://localhost/api/v1/auth/get-session")),
    ).toBeUndefined();
  });
});
