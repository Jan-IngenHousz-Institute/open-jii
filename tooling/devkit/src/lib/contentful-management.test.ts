import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { devkitEnvPath } from "./config.js";
import {
  ContentfulManagement,
  createContentfulAudit,
  loadContentfulConfig,
} from "./contentful-management.js";

const TOKEN = "secret-management-token";
const config = { space: "space1", environment: "master", token: TOKEN };

function entryBody(id: string) {
  return {
    sys: { id, version: 2, contentType: { sys: { id: "statusUpdate" } } },
    fields: { text: { "en-US": "Private draft text" } },
  };
}

function answering(status: number): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(entryBody("upd-1")), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
}

async function logOf(root: string) {
  return readFile(join(root, ".claude", "contentful-writes.log"), "utf8");
}

describe("the Contentful write log", () => {
  it("records each write with its method and resource, and never a read, a body or the token", async () => {
    const root = await mkdtemp(join(tmpdir(), "devkit-contentful-"));
    const client = new ContentfulManagement(
      config,
      answering(200),
      createContentfulAudit(root, { CLAUDE_CODE_SESSION_ID: "sess-1" }),
    );

    const draft = await client.createEntry("statusUpdate", entryBody("upd-1").fields);
    await client.getEntry("upd-1");
    await client.publishEntry(draft);

    const lines = (await logOf(root)).trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/ ok POST entries environment=master session=sess-1 root=/);
    expect(lines[1]).toMatch(/ ok PUT entries\/upd-1\/published environment=master /);

    const log = await logOf(root);
    expect(log).not.toContain("GET");
    expect(log).not.toContain(TOKEN);
    expect(log).not.toContain("Private draft text");
  });

  it("records a refused write as failed", async () => {
    const root = await mkdtemp(join(tmpdir(), "devkit-contentful-"));
    const client = new ContentfulManagement(
      config,
      answering(422),
      createContentfulAudit(root, {}),
    );

    await expect(client.createEntry("statusUpdate", {})).rejects.toThrow("returned 422");

    expect(await logOf(root)).toMatch(/ failed POST entries environment=master session=shell /);
  });
});

describe("loadContentfulConfig", () => {
  async function rootWith(file: string) {
    const root = await mkdtemp(join(tmpdir(), "devkit-contentful-"));
    await mkdir(join(root, "tooling", "devkit"), { recursive: true });
    await writeFile(devkitEnvPath(root), file);
    return root;
  }

  it("takes the shell over the file and trims what it reads", async () => {
    const root = await rootWith(
      "CONTENTFUL_SPACE_ID=from-file\nCONTENTFUL_SPACE_ENVIRONMENT= dev \n",
    );

    expect(
      await loadContentfulConfig(root, {
        CONTENTFUL_SPACE_ID: " from-shell ",
        CONTENTFUL_MANAGEMENT_TOKEN: " token ",
      }),
    ).toEqual({ space: "from-shell", environment: "dev", token: "token" });
  });

  it("reads the main checkout's file from a linked worktree, under the worktree's own", async () => {
    const main = await rootWith(
      "CONTENTFUL_SPACE_ID=main-space\nCONTENTFUL_MANAGEMENT_TOKEN=main-token\n",
    );
    const linked = await rootWith("CONTENTFUL_SPACE_ID=linked-space\n");
    await writeFile(join(linked, ".git"), `gitdir: ${main}/.git/worktrees/linked\n`);

    expect(await loadContentfulConfig(linked, {})).toEqual({
      space: "linked-space",
      environment: "",
      token: "main-token",
    });
  });

  it("falls back to the CMA name when the management token is empty", async () => {
    const root = await rootWith("CMA=alias-token\n");

    expect((await loadContentfulConfig(root, { CONTENTFUL_MANAGEMENT_TOKEN: "" })).token).toBe(
      "alias-token",
    );
  });
});
