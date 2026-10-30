import { describe, expect, it, vi } from "vitest";

import { equipmentNavigation } from "./equipment-navigation.js";

const config = { space: "space", environment: "master", token: "private-test-token" };
const oldLink = { sys: { type: "Link", linkType: "Entry", id: "home" } };
function fixture() {
  let footer = {
    sys: { id: "footer", version: 4, publishedVersion: 3, contentType: { sys: { id: "footer" } } },
    fields: {
      title: { "en-US": "Keep this" },
      navigationButtons: { "en-US": [oldLink], "de-DE": [] },
      menuButtons: { "en-US": [oldLink] },
    },
    metadata: { tags: [] },
  };
  let button:
    | {
        sys: {
          id: string;
          version: number;
          publishedVersion?: number;
          contentType: { sys: { id: string } };
        };
        fields: unknown;
      }
    | undefined;
  let domainReady = true;
  const handle = (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const path = url instanceof Request ? url.url : url.toString();
    const method = init?.method ?? "GET";
    const json = () => {
      if (typeof init?.body !== "string") throw new Error("Expected JSON body");
      return JSON.parse(init.body) as typeof footer;
    };
    if (path === "https://equipment.openjii.org")
      return new Response(null, { status: domainReady ? 200 : 503 });
    if (method === "GET") {
      if (path.endsWith("entries/footer")) return Response.json(footer);
      if (path.endsWith("locales"))
        return Response.json({
          items: [
            { code: "en-US", default: true },
            { code: "de-DE", default: false },
          ],
        });
      if (path.endsWith("content_types/componentButton"))
        return Response.json({
          fields: [
            { id: "internalName", localized: false },
            { id: "label", localized: true },
            { id: "url", localized: false },
          ],
        });
      if (path.includes("entries?")) return Response.json({ items: button ? [button] : [] });
    }
    if (method === "PUT" && path.endsWith("entries/openjii-equipment-navigation")) {
      button = {
        sys: {
          id: "openjii-equipment-navigation",
          version: 1,
          contentType: { sys: { id: "componentButton" } },
        },
        fields: json().fields,
      };
      return Response.json(button);
    }
    if (method === "PUT" && path.endsWith("openjii-equipment-navigation/published") && button) {
      expect(init?.headers).toHaveProperty("X-Contentful-Version", "1");
      button.sys.publishedVersion = button.sys.version++;
      return Response.json(button);
    }
    if (method === "PUT" && path.endsWith("entries/footer")) {
      expect(init?.headers).toHaveProperty("X-Contentful-Version", "4");
      footer = { ...footer, ...json(), sys: { ...footer.sys, version: 5 } };
      return Response.json(footer);
    }
    if (method === "PUT" && path.endsWith("footer/published")) {
      expect(init?.headers).toHaveProperty("X-Contentful-Version", "5");
      footer.sys.publishedVersion = footer.sys.version++;
      return Response.json(footer);
    }
    throw new Error(`Unexpected fixture request: ${method} ${path}`);
  };
  const request = vi.fn<typeof fetch>((url, init) => Promise.resolve(handle(url, init)));
  return {
    request,
    footer: () => footer,
    unavailable: () => {
      domainReady = false;
    },
  };
}
const apply = { footerId: "footer", apply: true, footerVersion: 4, buttonVersion: 0 };

describe("Equipment CMS navigation", () => {
  it("prints the proposed entry without credentials or network calls by default", async () => {
    const request = vi.fn<typeof fetch>();
    const result = await equipmentNavigation(
      {},
      { space: "", environment: "", token: "" },
      request,
    );
    expect(result).toMatchObject({
      dryRun: true,
      networkRequests: 0,
      entry: { label: "Equipment", url: "https://equipment.openjii.org" },
    });
    expect(request).not.toHaveBeenCalled();
  });
  it("inspects all affected locales without writing or exposing the token", async () => {
    const { request } = fixture();
    const result = await equipmentNavigation({ footerId: "footer" }, config, request);
    expect(result).toMatchObject({ dryRun: true, footerChanged: true });
    expect(request.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
    expect(JSON.stringify(result)).not.toContain(config.token);
  });
  it("publishes one button and both footer collections after the domain is live, then makes no further writes", async () => {
    const { request, footer } = fixture();
    await expect(equipmentNavigation(apply, config, request)).resolves.toMatchObject({
      applied: true,
    });
    expect(footer().fields.title).toEqual({ "en-US": "Keep this" });
    expect(footer().fields.navigationButtons["en-US"]).toHaveLength(2);
    expect(footer().fields.navigationButtons["de-DE"]).toHaveLength(1);
    expect(footer().fields.menuButtons["en-US"]).toHaveLength(2);
    request.mockClear();
    await equipmentNavigation({ ...apply, footerVersion: 6, buttonVersion: 2 }, config, request);
    expect(request.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
  });
  it("refuses to write while the public origin is unavailable", async () => {
    const { request, unavailable } = fixture();
    unavailable();
    await expect(equipmentNavigation(apply, config, request)).rejects.toThrow(
      "no CMS writes performed",
    );
    expect(request.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });
  it("requires the versions from the reviewed dry run", async () => {
    const { request } = fixture();
    await expect(
      equipmentNavigation({ ...apply, footerVersion: 3 }, config, request),
    ).rejects.toThrow("reviewed dry run");
    expect(request.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });
  it("refuses to publish unrelated pending footer edits", async () => {
    const { request, footer } = fixture();
    footer().sys.version = 5;
    await expect(equipmentNavigation(apply, config, request)).rejects.toThrow("pending edits");
    expect(request.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });
});
