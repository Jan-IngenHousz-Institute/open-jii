/**
 * Stages documentation media for apps/docs from the running local stack.
 *
 * Mirrors apps/docs/scripts/capture-mobile-media.sh: captures land in
 * apps/docs/.capture/web for review and are never published automatically.
 *
 *   pnpm --filter @repo/e2e capture-docs-media --list
 *   pnpm --filter @repo/e2e capture-docs-media --only dashboard,experiments-list
 *   pnpm --filter @repo/e2e capture-docs-media --theme dark
 */
import { chromium } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { FRAMES } from "../docs-media/frames.js";
import { SHOTS, SHOTS_BY_SLUG, enableVirtualAuthenticator } from "../docs-media/shots.js";
import type { Shot } from "../docs-media/shots.js";
import { dismissCookieBanner, locale } from "../helpers.js";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const authFile = path.join(import.meta.dirname, "..", ".auth", "seed.json");
const stagingDirectory =
  process.env.OPENJII_CAPTURE_STAGING_DIR ??
  path.join(import.meta.dirname, "../../docs/.capture/web");

/**
 * Development-only overlays that are not part of the product. Suppressing them
 * is not retouching: a production build renders none of them, and the
 * alternative is a docs image with the Next.js and TanStack Query badges in it.
 */
const DEV_CHROME_CSS = `
  nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button],
  .tsqd-open-btn-container, .tsqd-parent-container { display: none !important; }
`;

/** Animations mid-flight make stills non-reproducible. Never applied to video. */
const STILLNESS_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
`;

interface Options {
  readonly only: readonly string[] | null;
  readonly theme: "light" | "dark";
  readonly list: boolean;
}

function parseArguments(argv: readonly string[]): Options {
  let only: string[] | null = null;
  let theme: "light" | "dark" = "light";
  let list = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--list") list = true;
    else if (flag === "--only") only = (argv[++index] ?? "").split(",").filter(Boolean);
    else if (flag === "--theme") {
      const value = argv[++index];
      if (value !== "light" && value !== "dark") throw new Error(`Unknown theme: ${value}`);
      theme = value;
    } else throw new Error(`Unknown argument: ${flag}`);
  }
  return { list, only, theme };
}

function runFfmpeg(args: readonly string[], input: string): void {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${input}`);
}

function requireFfmpeg(): void {
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (probe.status !== 0) throw new Error("ffmpeg is required to normalize captures.");
}

/**
 * Strip metadata and encode. A desktop frame is already rendered at the
 * published size, so the scale filter is a guard against a capture arriving at
 * the wrong width rather than a resample step.
 */
function normalizeStill(input: string, output: string, width: number): void {
  // prettier-ignore
  runFfmpeg([
    "-i", input,
    "-map_metadata", "-1",
    "-vf", `scale=${width}:-2:flags=lanczos`,
    "-c:v", "libwebp", "-quality", "90", "-preset", "picture",
    output,
  ], input);
}

/** Recorded at the published size, so the clip is only trimmed and re-encoded. */
function normalizeVideo(input: string, output: string, startSeconds: number): void {
  // prettier-ignore
  runFfmpeg([
    "-ss", startSeconds.toFixed(2), "-i", input,
    "-map_metadata", "-1", "-an",
    "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0",
    "-row-mt", "1", "-deadline", "good", "-cpu-used", "2",
    output,
  ], input);
}

/** A still from the clip's first frame, for the docs `<video poster>`. */
function extractPoster(input: string, output: string): void {
  // prettier-ignore
  runFfmpeg([
    "-i", input, "-map_metadata", "-1", "-frames:v", "1",
    "-c:v", "libwebp", "-quality", "90", "-preset", "picture",
    output,
  ], input);
}

/** Answers the SDK's flag request locally with the given flags on; nothing else is touched. */
async function pinFeatureFlags(page: Page, flags: readonly string[]): Promise<void> {
  const body = {
    errorsWhileComputingFlags: false,
    flags: Object.fromEntries(
      flags.map((key) => [key, { key, enabled: true, variant: null, reason: { code: "pinned" } }]),
    ),
    featureFlags: Object.fromEntries(flags.map((key) => [key, true])),
    featureFlagPayloads: {},
    sessionRecording: false,
  };
  await page.route("**/ingest/flags/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

async function preparePage(page: Page, theme: Options["theme"], freeze: boolean): Promise<void> {
  await page.addStyleTag({ content: DEV_CHROME_CSS });
  if (freeze) await page.addStyleTag({ content: STILLNESS_CSS });
  await dismissCookieBanner(page);
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.waitForTimeout(400);
}

const contextOpenedAt = new WeakMap<BrowserContext, number>();

async function captureShot(
  context: BrowserContext,
  shot: Shot,
  options: Options,
  suffix: string,
): Promise<readonly string[]> {
  const isVideo = shot.perform !== undefined;
  const page = await context.newPage();
  try {
    if (shot.webauthn) await enableVirtualAuthenticator(await context.newCDPSession(page));
    if (shot.featureFlags) await pinFeatureFlags(page, shot.featureFlags);
    const route = typeof shot.route === "string" ? shot.route : await shot.route();
    await page.goto(`${baseUrl}/${locale}${route}`, { waitUntil: "networkidle" });
    await preparePage(page, options.theme, !isVideo);
    await shot.prepare?.(page);
    await preparePage(page, options.theme, !isVideo);

    if (!isVideo) {
      const rawPath = path.join(stagingDirectory, `${shot.slug}${suffix}.raw.png`);
      const outputPath = path.join(stagingDirectory, `${shot.slug}${suffix}.webp`);
      await page.screenshot({ path: rawPath });
      normalizeStill(rawPath, outputPath, FRAMES[shot.frame].publishedWidth);
      await fs.rm(rawPath, { force: true });
      return [outputPath];
    }

    // Playwright records from context creation, so navigation and setup land in
    // the file. Note where the flow actually begins and trim back to it.
    const flowStartedAt = Date.now();
    await shot.perform(page);
    await page.waitForTimeout((shot.tailSeconds ?? 2) * 1000);
    const openedAt = contextOpenedAt.get(context) ?? flowStartedAt;
    const trimTo = Math.max(0, (flowStartedAt - openedAt) / 1000 - 0.3);

    const video = page.video();
    await page.close();
    if (!video) throw new Error(`No video recorded for ${shot.slug}`);
    const videoRaw = path.join(stagingDirectory, `${shot.slug}${suffix}.raw.webm`);
    await fs.rename(await video.path(), videoRaw);
    const videoOut = path.join(stagingDirectory, `${shot.slug}${suffix}.webm`);
    const posterOut = path.join(stagingDirectory, `${shot.slug}${suffix}-poster.webp`);
    normalizeVideo(videoRaw, videoOut, trimTo);
    extractPoster(videoOut, posterOut);
    await fs.rm(videoRaw, { force: true });
    return [videoOut, posterOut];
  } finally {
    if (!page.isClosed()) await page.close();
  }
}

const options = parseArguments(process.argv.slice(2));

if (options.list) {
  for (const shot of SHOTS) {
    const kind = shot.perform ? "video" : "still";
    process.stdout.write(
      `${shot.slug.padEnd(30)} ${shot.frame.padEnd(8)} ${kind.padEnd(6)} ${shot.publish}\n`,
    );
  }
  process.exit(0);
}

requireFfmpeg();
await fs.mkdir(stagingDirectory, { recursive: true });

const selected = options.only
  ? options.only.map((slug) => {
      const shot = SHOTS_BY_SLUG.get(slug);
      if (!shot) throw new Error(`Unknown shot: ${slug}`);
      return shot;
    })
  : SHOTS;

const suffix = options.theme === "dark" ? ".dark" : "";
const browser = await chromium.launch();
const failures: string[] = [];
try {
  for (const shot of selected) {
    const frame = FRAMES[shot.frame];
    const context = await browser.newContext({
      colorScheme: options.theme,
      deviceScaleFactor: frame.deviceScaleFactor,
      // Unauthenticated surfaces must not carry a session.
      storageState: shot.anonymous ? undefined : authFile,
      recordVideo: shot.perform ? { dir: stagingDirectory, size: frame.viewport } : undefined,
      reducedMotion: "reduce",
      viewport: frame.viewport,
    });
    contextOpenedAt.set(context, Date.now());
    try {
      for (const output of await captureShot(context, shot, options, suffix)) {
        process.stdout.write(`staged ${path.relative(process.cwd(), output)}\n`);
      }
    } catch (error) {
      failures.push(`${shot.slug}: ${(error as Error).message.split("\n")[0]}`);
      process.stderr.write(`FAILED ${shot.slug}: ${(error as Error).message.split("\n")[0]}\n`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

process.stdout.write(
  `\nStaged in ${stagingDirectory}. Review every frame before publishing, then record the checksum in apps/docs/media/web/manifest.json.\n`,
);
if (failures.length > 0) {
  process.stderr.write(`\n${failures.length} shot(s) failed:\n${failures.join("\n")}\n`);
  process.exit(1);
}
