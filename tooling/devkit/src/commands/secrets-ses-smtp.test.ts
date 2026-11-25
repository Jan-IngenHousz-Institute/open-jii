import { describe, expect, it, vi } from "vitest";

import { parseArgs, setSesSmtp, smtpPassword } from "./secrets-ses-smtp.js";

const accessKey = JSON.stringify({
  AccessKey: {
    UserName: "dev-ses-smtp-user",
    AccessKeyId: "AKIAEXAMPLE",
    SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  },
});

describe("smtpPassword", () => {
  it("matches AWS's documented derivation", () => {
    // From the Python reference in the SES developer guide, for this key and region.
    expect(smtpPassword("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", "eu-central-1")).toBe(
      "BF0/eIJm0ruTHsSjOkRuOGzGF+zeSyE3aiRzrzUQ8LwG",
    );
  });
});

describe("parseArgs", () => {
  it("reads the environment and defaults the profile", () => {
    expect(parseArgs(["--", "prod"])).toEqual({ environment: "prod", awsProfile: "openjii-prod" });
    expect(() => parseArgs(["staging"])).toThrow("Usage");
    expect(() => parseArgs(["dev", "--key", "x"])).toThrow("Unknown argument --key");
  });
});

describe("setSesSmtp", () => {
  it("stores one URL as both servers, keeps other keys, and prints only the key id", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const lines: string[] = [];

    await setSesSmtp(
      { environment: "dev", awsProfile: "p" },
      {
        readInput: () => Promise.resolve(accessKey),
        read: () => Promise.resolve(JSON.stringify({ AUTH_EMAIL_FROM: "auth@example.org" })),
        put,
        write: (text) => lines.push(text),
      },
    );

    const stored = JSON.parse(put.mock.calls[0]?.[1] as string) as Record<string, string>;
    expect(put.mock.calls[0]?.[0]).toBe("openjii-ses-secrets-dev");
    expect(stored.AUTH_EMAIL_FROM).toBe("auth@example.org");
    expect(stored.AUTH_EMAIL_SERVER).toBe(
      "smtp://AKIAEXAMPLE:BF0%2FeIJm0ruTHsSjOkRuOGzGF%2BzeSyE3aiRzrzUQ8LwG" +
        "@email-smtp.eu-central-1.amazonaws.com:587",
    );
    expect(stored.BACKEND_EMAIL_SERVER).toBe(stored.AUTH_EMAIL_SERVER);
    const output = lines.join("");
    expect(output).toContain("AKIAEXAMPLE");
    expect(output).not.toContain("BF0");
    expect(output).not.toContain("EXAMPLEKEY");
  });

  it("refuses a stored value that is not JSON without printing it", async () => {
    const put = vi.fn();

    const error = (await setSesSmtp(
      { environment: "dev", awsProfile: "p" },
      {
        readInput: () => Promise.resolve(accessKey),
        read: () => Promise.resolve("pasted-raw-password"),
        put,
        write: () => undefined,
      },
    ).catch((caught: unknown) => caught)) as Error;

    expect(error.message).toBe(
      "openjii-ses-secrets-dev does not hold a JSON object; refusing to replace it",
    );
    expect(error.cause).toBeUndefined();
    expect(put).not.toHaveBeenCalled();
  });

  it("refuses input that is not a new access key", async () => {
    const put = vi.fn();
    const deps = (input: string) => ({
      readInput: () => Promise.resolve(input),
      read: () => Promise.resolve(null),
      put,
      write: () => undefined,
    });

    await expect(
      setSesSmtp({ environment: "dev", awsProfile: "p" }, deps("AKIA...")),
    ).rejects.toThrow("not the JSON");
    await expect(
      setSesSmtp({ environment: "dev", awsProfile: "p" }, deps(JSON.stringify({ AccessKey: {} }))),
    ).rejects.toThrow("no AccessKey");
    expect(put).not.toHaveBeenCalled();
  });
});
