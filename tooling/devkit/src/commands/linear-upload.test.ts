import { describe, expect, it } from "vitest";

import type { LinearClient } from "../lib/linear.js";
import { contentTypeFor, parseArgs, uploadFile } from "./linear-upload.js";
import type { UploadDependencies } from "./linear-upload.js";

interface RecordedCall {
  document: string;
  variables: Record<string, unknown>;
}

/** Fixtures are untyped while the client contract is generic; this is the one place that gap is bridged. */
function fixtureClient(
  answer: (document: string, variables: Record<string, unknown>) => unknown,
): LinearClient {
  return {
    query: <T>(document: string, variables: Record<string, unknown> = {}): Promise<T> =>
      Promise.resolve(answer(document, variables) as T),
  };
}

function deps(overrides: Partial<UploadDependencies> = {}) {
  const calls: RecordedCall[] = [];
  const puts: { url: string; headers: Record<string, string>; size: number }[] = [];
  const lines: string[] = [];
  const value: UploadDependencies = {
    client: fixtureClient((document, variables) => {
      calls.push({ document, variables });
      return {
        fileUpload: {
          success: true,
          uploadFile: {
            uploadUrl: "https://uploads.example/signed",
            assetUrl: "https://uploads.linear.app/org/asset",
            headers: [{ key: "x-amz-acl", value: "public-read" }],
          },
        },
      };
    }),
    readBytes: () => Promise.resolve(new Uint8Array([1, 2, 3])),
    put: (url, headers, body) => {
      puts.push({ url, headers, size: body.byteLength });
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve("") });
    },
    write: (text) => lines.push(text),
    ...overrides,
  };
  return { value, calls, puts, lines };
}

describe("parseArgs and contentTypeFor", () => {
  it("infers the media type from the extension and accepts an explicit one", () => {
    expect(parseArgs(["docs/sketches.html"])).toEqual({
      file: "docs/sketches.html",
      contentType: "text/html",
    });
    expect(parseArgs(["--type", "font/woff2", "brand.woff2"]).contentType).toBe("font/woff2");
    expect(contentTypeFor("canvas.PNG")).toBe("image/png");
    expect(contentTypeFor("bundle.tar.gz")).toBeNull();
  });

  it("requires a file and a value after --type", () => {
    expect(() => parseArgs([])).toThrow("Usage: linear-upload");
    expect(() => parseArgs(["--type"])).toThrow("--type requires");
    expect(() => parseArgs(["--type", "--apply", "x.html"])).toThrow("--type requires");
  });
});

describe("uploadFile", () => {
  it("asks Linear for a target, PUTs the bytes with its headers, and prints the asset URL", async () => {
    const d = deps();

    const url = await uploadFile("/tmp/sketches.html", "text/html", d.value);

    expect(url).toBe("https://uploads.linear.app/org/asset");
    expect(d.calls[0]?.variables).toEqual({
      contentType: "text/html",
      filename: "sketches.html",
      size: 3,
    });
    expect(d.puts).toEqual([
      {
        url: "https://uploads.example/signed",
        headers: {
          "content-type": "text/html",
          "cache-control": "public, max-age=31536000",
          "x-amz-acl": "public-read",
        },
        size: 3,
      },
    ]);
    expect(d.lines.join("")).toBe("https://uploads.linear.app/org/asset\n");
  });

  it("reports a refused target and a failed PUT with the status", async () => {
    const refused = deps({
      client: fixtureClient(() => ({ fileUpload: { success: false, uploadFile: null } })),
    });
    await expect(uploadFile("x.html", "text/html", refused.value)).rejects.toThrow(
      "Linear refused the upload",
    );

    const failed = deps({
      put: () =>
        Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve("expired") }),
    });
    await expect(uploadFile("x.html", "text/html", failed.value)).rejects.toThrow(
      "failed with 403: expired",
    );
    expect(failed.lines).toEqual([]);
  });
});
