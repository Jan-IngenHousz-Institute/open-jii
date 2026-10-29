import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { checkMediaReferences } from "./check-media-references.mjs";

const pending = {
  path: "/img/recording.webm",
  staged: "apps/docs/.capture/web/recording.webm",
  ticket: "OJD-2217",
  date: "2026-10-21",
};

async function fixture(t, { published = false, listed = false } = {}) {
  const appRoot = await mkdtemp(path.join(os.tmpdir(), "openjii-media-"));
  t.after(() => rm(appRoot, { recursive: true, force: true }));
  for (const dir of ["content", "media", "public/img/chrome-refresh", "public/img/workbooks"]) {
    await mkdir(path.join(appRoot, dir), { recursive: true });
  }
  await writeFile(path.join(appRoot, "content/page.mdx"), '<video src="/img/recording.webm" />');
  await writeFile(
    path.join(appRoot, "media/pending.json"),
    JSON.stringify(listed ? [pending] : []),
  );
  if (published) await writeFile(path.join(appRoot, "public/img/recording.webm"), "fixture");
  return appRoot;
}

test("missing unlisted media fails", async (t) => {
  const appRoot = await fixture(t);
  const result = await checkMediaReferences({ appRoot });
  assert.match(result.problems.join("\n"), /missing media/);
});

test("missing listed media is reported pending and passes", async (t) => {
  const appRoot = await fixture(t, { listed: true });
  const result = await checkMediaReferences({ appRoot });
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.pending, [pending]);
});

test("published media still listed pending fails", async (t) => {
  const appRoot = await fixture(t, { listed: true, published: true });
  const result = await checkMediaReferences({ appRoot });
  assert.match(result.problems.join("\n"), /published; remove from pending/);
});

test("strict mode refuses pending publication", async (t) => {
  const appRoot = await fixture(t, { listed: true });
  const result = await checkMediaReferences({ appRoot, strict: true });
  assert.match(result.problems.join("\n"), /pending publication/);
});

test("published media passes after clearing pending", async (t) => {
  const appRoot = await fixture(t, { published: true });
  assert.deepEqual((await checkMediaReferences({ appRoot })).problems, []);
});
