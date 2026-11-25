import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseArgs, servingStoreReloader, setSecret } from "./secrets-set.js";
import type { SecretsSetDependencies, SsmCommands } from "./secrets-set.js";

function deps(current: string | null, input = "s3cr3t-value\n") {
  const lines: string[] = [];
  const put = vi.fn<SecretsSetDependencies["put"]>().mockResolvedValue(undefined);
  const putScoped = vi.fn<SecretsSetDependencies["putScoped"]>().mockResolvedValue(undefined);
  const read = vi.fn<SecretsSetDependencies["read"]>().mockResolvedValue(current);
  const reloadServingStore = vi
    .fn<SecretsSetDependencies["reloadServingStore"]>()
    .mockResolvedValue(undefined);
  const value: SecretsSetDependencies = {
    readInput: () => Promise.resolve(input),
    read,
    put,
    putScoped,
    reloadServingStore,
    write: (text) => lines.push(text),
  };
  return { value, lines, put, putScoped, read, reloadServingStore };
}

describe("parseArgs", () => {
  it("reads the environment, secret, key and profile, defaulting the profile", () => {
    expect(parseArgs(["--", "dev", "auth", "--key", "AUTH_SECRET"])).toEqual({
      environment: "dev",
      secret: "auth",
      key: "AUTH_SECRET",
      awsProfile: "openjii-dev",
      databricksProfile: "dev",
    });
    expect(parseArgs(["prod", "status-slack", "--aws-profile", "Prod"]).awsProfile).toBe("Prod");
    expect(
      parseArgs(["prod", "webhook-scope", "--databricks-profile", "prod-admin"]).databricksProfile,
    ).toBe("prod-admin");
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
      {
        environment: "dev",
        secret: "auth",
        key: "AUTH_SECRET",
        awsProfile: "p",
        databricksProfile: "dev",
      },
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
        databricksProfile: "dev",
      },
      d.value,
    );

    expect(d.lines.join("")).toContain("still without a value: CONTENTFUL_SPACE_ID");
  });

  it("starts an empty JSON object when the secret has no value yet", async () => {
    const d = deps(null);

    await setSecret(
      {
        environment: "prod",
        secret: "mailchimp",
        key: "MAILCHIMP_API_KEY",
        awsProfile: "p",
        databricksProfile: "dev",
      },
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
      {
        environment: "prod",
        secret: "status-slack",
        key: null,
        awsProfile: "p",
        databricksProfile: "dev",
      },
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
    const base = { environment: "dev", awsProfile: "p", databricksProfile: "dev" } as const;

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
      databricksProfile: "dev",
    } as const;

    await expect(setSecret(args, deps("{}", "\n").value)).rejects.toThrow("No value received");
    const broken = deps("not json");
    await expect(setSecret(args, broken.value)).rejects.toThrow("does not hold a JSON object");
    expect(broken.put).not.toHaveBeenCalled();
  });

  it("writes a Databricks scope key as its own secret, never into Secrets Manager", async () => {
    const d = deps("{}");

    await setSecret(
      {
        environment: "prod",
        secret: "serving-store-scope",
        key: "writer-password",
        awsProfile: "p",
        databricksProfile: "prod",
      },
      d.value,
    );

    expect(d.putScoped).toHaveBeenCalledWith(
      "serving-store-prod",
      "writer-password",
      "s3cr3t-value",
    );
    expect(d.read).not.toHaveBeenCalled();
    expect(d.put).not.toHaveBeenCalled();
    expect(d.lines.join("")).not.toContain("s3cr3t-value");
  });

  it("refuses a key a scope does not hold", async () => {
    const d = deps("{}");

    await expect(
      setSecret(
        {
          environment: "dev",
          secret: "webhook-scope",
          key: "webhook_api_key",
          awsProfile: "p",
          databricksProfile: "dev",
        },
        d.value,
      ),
    ).rejects.toThrow("has no key webhook_api_key");
    expect(d.putScoped).not.toHaveBeenCalled();
  });

  it("names each serving store role's own secret", async () => {
    const d = deps(JSON.stringify({ username: "openjii_reader" }));

    await setSecret(
      {
        environment: "dev",
        secret: "serving-store-reader",
        key: "password",
        awsProfile: "p",
        databricksProfile: "dev",
      },
      d.value,
    );

    expect(d.read).toHaveBeenCalledWith("openjii-serving-store-dev-reader");
    expect(d.lines.join("")).not.toContain("still without a value");
  });

  it("passes a writer password to the pipelines' scope, then to the store", async () => {
    const d = deps(JSON.stringify({ username: "openjii_writer" }));
    const order: string[] = [];
    d.put.mockImplementation(() => Promise.resolve(void order.push("secret")));
    d.putScoped.mockImplementation(() => Promise.resolve(void order.push("scope")));
    d.reloadServingStore.mockImplementation(() => Promise.resolve(void order.push("store")));

    await setSecret(
      {
        environment: "prod",
        secret: "serving-store-writer",
        key: "password",
        awsProfile: "p",
        databricksProfile: "prod",
      },
      d.value,
    );

    expect(order).toEqual(["secret", "scope", "store"]);
    expect(d.putScoped).toHaveBeenCalledWith(
      "serving-store-prod",
      "writer-password",
      "s3cr3t-value",
    );
    expect(d.reloadServingStore).toHaveBeenCalledWith("openjii-serving-store-prod");
    const output = d.lines.join("");
    expect(output).toContain("the pipelines' feed reads the scope on every write");
    expect(output).not.toContain("s3cr3t-value");
  });

  it("leaves the scope alone for the reader, and the store alone for a username", async () => {
    const base = { environment: "dev", awsProfile: "p", databricksProfile: "dev" } as const;
    const reader = deps(JSON.stringify({ username: "openjii_reader" }));

    await setSecret({ ...base, secret: "serving-store-reader", key: "password" }, reader.value);

    expect(reader.putScoped).not.toHaveBeenCalled();
    expect(reader.reloadServingStore).toHaveBeenCalledWith("openjii-serving-store-dev");
    expect(reader.lines.join("")).toContain("Redeploy the backend now");

    const username = deps("{}", "openjii_reader\n");
    await setSecret({ ...base, secret: "serving-store-reader", key: "username" }, username.value);
    expect(username.put).toHaveBeenCalledWith(
      "openjii-serving-store-dev-reader",
      JSON.stringify({ username: "openjii_reader" }),
    );
    expect(username.reloadServingStore).not.toHaveBeenCalled();
  });

  it("refuses a username the store's users are not named", async () => {
    const d = deps("{}", "reader\n");

    await expect(
      setSecret(
        {
          environment: "dev",
          secret: "serving-store-reader",
          key: "username",
          awsProfile: "p",
          databricksProfile: "dev",
        },
        d.value,
      ),
    ).rejects.toThrow("serving-store-reader's username is openjii_reader; nothing was set");
    expect(d.put).not.toHaveBeenCalled();
  });

  it.each([
    ["a second line break", "s3cr3t\n\n"],
    ["a trailing space", "s3cr3t \n"],
    ["a leading tab", "\ts3cr3t\n"],
    ["a line break inside", "s3c\nr3t\n"],
  ])("refuses a store password with %s before any write", async (_, input) => {
    const d = deps(JSON.stringify({ username: "openjii_writer" }), input);

    await expect(
      setSecret(
        {
          environment: "dev",
          secret: "serving-store-writer",
          key: "password",
          awsProfile: "p",
          databricksProfile: "dev",
        },
        d.value,
      ),
    ).rejects.toThrow("may not start or end with whitespace or hold a control character");
    expect(d.put).not.toHaveBeenCalled();
    expect(d.putScoped).not.toHaveBeenCalled();
    expect(d.reloadServingStore).not.toHaveBeenCalled();
  });

  it("names what already holds the password when the store cannot reread it", async () => {
    const base = { environment: "dev", awsProfile: "p", databricksProfile: "dev" } as const;
    const reader = deps(JSON.stringify({ username: "openjii_reader" }));
    reader.reloadServingStore.mockRejectedValue(new Error("No instance tagged Name=x"));

    await expect(
      setSecret({ ...base, secret: "serving-store-reader", key: "password" }, reader.value),
    ).rejects.toThrow(
      /No instance tagged Name=x\nthe Secrets Manager secret already holds the new password.*same password, not a new one/s,
    );

    const writer = deps(JSON.stringify({ username: "openjii_writer" }));
    writer.reloadServingStore.mockRejectedValue(new Error("timed out"));

    const error = (await setSecret(
      { ...base, secret: "serving-store-writer", key: "password" },
      writer.value,
    ).catch((caught: unknown) => caught)) as Error;
    expect(error.message).toContain(
      "the Secrets Manager secret and writer-password in serving-store-dev already hold",
    );
    expect(error.message).not.toContain("s3cr3t-value");
  });
});

describe("servingStoreReloader", () => {
  function ssm(statuses: { status?: string; targetCount?: number }[], output = "") {
    const commands = {
      run: vi.fn<SsmCommands["run"]>().mockResolvedValue("cmd-1"),
      status: vi.fn<SsmCommands["status"]>(),
      output: vi.fn<SsmCommands["output"]>().mockResolvedValue(output),
    };
    for (const status of statuses) commands.status.mockResolvedValueOnce(status);
    return commands;
  }
  const noWait = () => Promise.resolve();
  let write: ReturnType<typeof vi.fn<(output: string) => void>>;
  beforeEach(() => {
    write = vi.fn<(output: string) => void>();
  });

  it("runs the passwords script on the named instance, checking the logins, and waits for it", async () => {
    const commands = ssm([
      { status: "Pending" },
      { status: "InProgress", targetCount: 1 },
      { status: "Success", targetCount: 1 },
    ]);

    await servingStoreReloader(commands, write, noWait)("openjii-serving-store-dev");

    expect(commands.run).toHaveBeenCalledWith(
      "openjii-serving-store-dev",
      "/usr/local/bin/openjii-clickhouse-passwords --check",
    );
    expect(commands.status).toHaveBeenCalledTimes(3);
    expect(write).toHaveBeenCalledWith(
      "Running the passwords script on openjii-serving-store-dev: SSM command cmd-1\n",
    );
  });

  it("fails when no instance carries the name", async () => {
    const commands = ssm([{ status: "Success", targetCount: 0 }]);

    await expect(
      servingStoreReloader(commands, write, noWait)("openjii-serving-store-dev"),
    ).rejects.toThrow("No instance tagged Name=openjii-serving-store-dev");
  });

  it("fails with the script's output when it does not succeed", async () => {
    const commands = ssm([{ status: "Failed", targetCount: 1 }], "AccessDeniedException");

    await expect(
      servingStoreReloader(commands, write, noWait)("openjii-serving-store-dev"),
    ).rejects.toThrow(/ended Failed \(SSM command cmd-1\):\nAccessDeniedException/);
  });

  it("names the command to follow when it outlasts the wait", async () => {
    const commands = ssm([]);
    commands.status.mockResolvedValue({ status: "InProgress", targetCount: 1 });

    await expect(
      servingStoreReloader(commands, write, noWait)("openjii-serving-store-dev"),
    ).rejects.toThrow(
      "It may still be running; follow it with aws ssm list-command-invocations --command-id cmd-1 --details",
    );
  });
});
