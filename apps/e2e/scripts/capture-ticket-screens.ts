/**
 * Captures the screens a Linear ticket carries, from the running local stack, with each shot's
 * fixtures answering the requests a local stack cannot, such as warehouse reads. Stills land in
 * apps/e2e/.ticket-screens for review before they are uploaded to a ticket.
 *
 *   pnpm --filter @repo/e2e capture-ticket-screens --list
 *   pnpm --filter @repo/e2e capture-ticket-screens --only example-data-table
 *   pnpm --filter @repo/e2e capture-ticket-screens --theme dark
 */
import { chromium } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

import { preparePage } from "../capture-page.js";
import { locale } from "../helpers.js";
import { PinnedFeatureFlags } from "../pinned-feature-flags.js";
import { HideTestPrefixes } from "../ticket-screens/hide-test-prefixes.js";
import { SHOTS, SHOTS_BY_SLUG } from "../ticket-screens/shots.js";
import type { TicketShot } from "../ticket-screens/shots.js";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const authFile = path.join(import.meta.dirname, "..", ".auth", "seed.json");
const outputDirectory =
  process.env.OPENJII_TICKET_SCREENS_DIR ?? path.join(import.meta.dirname, "..", ".ticket-screens");
const defaultViewport = { width: 1440, height: 900 };

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

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";
}

async function captureShot(
  context: BrowserContext,
  shot: TicketShot,
  options: Options,
  output: string,
): Promise<void> {
  const page = await context.newPage();
  try {
    // Installed first so it answers last: a shot's own fixtures win, and it cleans the rest.
    await new HideTestPrefixes().install(page);
    if (shot.featureFlags) await new PinnedFeatureFlags(shot.featureFlags).install(page);
    for (const fixture of shot.fixtures ?? []) await fixture.install(page);

    const route = typeof shot.route === "string" ? shot.route : await shot.route();
    await page.goto(`${baseUrl}/${locale}${route}`, { waitUntil: "domcontentloaded" });
    await preparePage(page, options.theme, true);
    const clip = await shot.prepare?.(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: output, clip });
  } catch (error) {
    // The frame it stopped on usually says why.
    await page.screenshot({ path: output.replace(/\.png$/, ".failed.png") }).catch(() => undefined);
    throw error;
  } finally {
    await page.close();
  }
}

const options = parseArguments(process.argv.slice(2));

if (options.list) {
  for (const shot of SHOTS) {
    const route = typeof shot.route === "string" ? shot.route : "(resolved when captured)";
    process.stdout.write(`${shot.slug.padEnd(40)} ${route}\n`);
  }
  process.exit(0);
}

await fs.mkdir(outputDirectory, { recursive: true });

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
    const context = await browser.newContext({
      colorScheme: options.theme,
      deviceScaleFactor: 2,
      storageState: shot.anonymous ? undefined : authFile,
      reducedMotion: "reduce",
      viewport: shot.viewport ?? defaultViewport,
    });
    const output = path.join(outputDirectory, `${shot.slug}${suffix}.png`);
    try {
      await captureShot(context, shot, options, output);
      process.stdout.write(`captured ${path.relative(process.cwd(), output)}\n`);
    } catch (error) {
      failures.push(`${shot.slug}: ${firstLine(error)}`);
      process.stderr.write(`FAILED ${shot.slug}: ${firstLine(error)}\n`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

process.stdout.write(
  `\nCaptured in ${outputDirectory}. Check each one shows only what its ticket's criteria say before uploading it.\n`,
);
if (failures.length > 0) {
  process.stderr.write(`\n${failures.length} shot(s) failed:\n${failures.join("\n")}\n`);
  process.exit(1);
}
