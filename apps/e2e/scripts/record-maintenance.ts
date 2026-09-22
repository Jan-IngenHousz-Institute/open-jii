import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.BASE_URL ?? process.env.E2E_BASE_URL ?? "http://localhost:3000";
const outputDirectory = process.env.OUT_DIR ?? "/tmp/maint-rec";
const viewport = { width: 1280, height: 800 };
const pages = [
  ["/en-US", "home"],
  ["/en-US/about", "about"],
  ["/en-US/faq", "faq"],
  ["/en-US/blog", "blog"],
] as const;

await fs.mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: outputDirectory, size: viewport },
  });
  const page = await context.newPage();
  for (const [route, name] of pages) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    await page.getByText(/back soon/i).waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: path.join(outputDirectory, `${name}.png`) });
    process.stdout.write(`${route} -> HTTP ${response?.status() ?? "?"} (maintenance shown)\n`);
  }

  const video = page.video();
  await context.close();
  if (video) {
    await fs.rename(await video.path(), path.join(outputDirectory, "maintenance.webm"));
    process.stdout.write(`video -> ${path.join(outputDirectory, "maintenance.webm")}\n`);
  }
} finally {
  await browser.close();
}
