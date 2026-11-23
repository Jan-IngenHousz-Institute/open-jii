import { describe, expect, it, vi } from "vitest";

import { parseArgs, setSecret } from "./secrets-set.js";
import type { SecretsSetDependencies } from "./secrets-set.js";

function deps(current: string | null, input = "s3cr3t-value\n") {
  const lines: string[] = [];
  const put = vi.fn<SecretsSetDependencies["put"]>().mockResolvedValue(undefined);
  const read = vi.fn<SecretsSetDependencies["read"]>().mockResolvedValue(current);
  const value: SecretsSetDependencies = {
    readInput: () => Promise.resolve(input),
    read,
    put,
    write: (text) => lines.push(text),
  };
  return { value, lines, put, read };
}

describe("parseArgs", () => {
  it("reads the environment, secret, key and profile, defaulting the profile", () => {
    expect(parseArgs(["--", "dev", "auth", "--key", "AUTH_SECRET"])).toEqual({
      environment: "dev",
      secret: "auth",
      key: "AUTH_SECRET",
      awsProfile: "openjii-dev",
    });
    expect(parseArgs(["prod", "status-slack", "--aws-profile", "Prod"]).awsProfile).toBe("Prod");
  });

  it("refuses an unknown environment, secret or flag", () => {
    expect(() => parseArgs(["staging", "auth"])).toThrow("Usage");
    expect(() => parseArgs(["dev", "database"])).toThrow("Usage");
    expect(() => parseArgs(["dev", "auth", "--force"])).toThrow("Unknown argument --force");
  });
});

describe("setSecret", () => {
  it("merges one key into the JSON and never prints the value", async () => {
    const d = deps(JSON.stringify({ AUTH_SECRET: "old", AUTH_GITHUB_ID: "id" }));

    await setSecret(
      { environment: "dev", secret: "auth", key: "AUTH_SECRET", awsProfile: "p" },
      d.value,
    );

    expect(d.read).toHaveBeenCalledWith("openjii-auth-secrets-dev");
    expect(JSON.parse(d.put.mock.calls[0]?.[1] ?? "")).toEqual({
      AUTH_SECRET: "s3cr3t-value",
      AUTH_GITHUB_ID: "id",
    });
    const output = d.lines.join("");
    expect(output).toContain("Set AUTH_SECRET in openjii-auth-secrets-dev");
    expect(output).toContain("still without a value: NOTIFICATION_UNSUBSCRIBE_SECRET");
    expect(output).not.toContain("s3cr3t-value");
  });

  it("lists a key with an empty value as still without a value", async () => {
    const d = deps(JSON.stringify({ CONTENTFUL_SPACE_ID: "", CONTENTFUL_ACCESS_TOKEN: "t" }));

    await setSecret(
      {
        environment: "dev",
        secret: "status-contentful",
        key: "CONTENTFUL_ACCESS_TOKEN",
        awsProfile: "p",
      },
      d.value,
    );

    expect(d.lines.join("")).toContain("still without a value: CONTENTFUL_SPACE_ID");
  });

  it("starts an empty JSON object when the secret has no value yet", async () => {
    const d = deps(null);

    await setSecret(
      { environment: "prod", secret: "mailchimp", key: "MAILCHIMP_API_KEY", awsProfile: "p" },
      d.value,
    );

    expect(d.put).toHaveBeenCalledWith(
      "openjii-mailchimp-secrets-prod",
      JSON.stringify({ MAILCHIMP_API_KEY: "s3cr3t-value" }),
    );
  });

  it("writes a plain secret whole, without reading it", async () => {
    const d = deps("old", "https://hooks.slack.example/T/B/x\n");

    await setSecret(
      { environment: "prod", secret: "status-slack", key: null, awsProfile: "p" },
      d.value,
    );

    expect(d.read).not.toHaveBeenCalled();
    expect(d.put).toHaveBeenCalledWith(
      "openjii-status-slack-prod",
      "https://hooks.slack.example/T/B/x",
    );
  });

  it("refuses a missing, misspelt or unexpected key before writing", async () => {
    const d = deps("{}");
    const base = { environment: "dev", awsProfile: "p" } as const;

    await expect(setSecret({ ...base, secret: "auth", key: null }, d.value)).rejects.toThrow(
      "needs --key",
    );
    await expect(
      setSecret({ ...base, secret: "auth", key: "AUTH_SECERT" }, d.value),
    ).rejects.toThrow("has no key AUTH_SECERT");
    await expect(
      setSecret({ ...base, secret: "status-slack", key: "URL" }, d.value),
    ).rejects.toThrow("leave out --key");
    expect(d.put).not.toHaveBeenCalled();
  });

  it("refuses an empty value and a secret that is not a JSON object", async () => {
    const args = {
      environment: "dev",
      secret: "auth",
      key: "AUTH_SECRET",
      awsProfile: "p",
    } as const;

    await expect(setSecret(args, deps("{}", "\n").value)).rejects.toThrow("No value received");
    const broken = deps("not json");
    await expect(setSecret(args, broken.value)).rejects.toThrow("does not hold a JSON object");
    expect(broken.put).not.toHaveBeenCalled();
  });
});
