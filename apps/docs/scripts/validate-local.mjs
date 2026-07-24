import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createStaticExportServer, loadRedirects } from "./serve-static-export.mjs";
import { runValidation } from "./validate-deployment.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exportRoot = path.join(appRoot, "out");
const redirectsPath = path.join(appRoot, "redirects.json");

const previewImages = ["opengraph-image", "twitter-image"];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

async function checkPreviewImages() {
  for (const name of previewImages) {
    const file = path.join(exportRoot, name);
    const image = await readFile(file);
    if (!image.subarray(0, pngSignature.length).equals(pngSignature)) {
      throw new Error(`${file} is not a PNG`);
    }
    if (image.readUInt32BE(16) !== 1200 || image.readUInt32BE(20) !== 630) {
      throw new Error(`${file} does not have the expected 1200x630 dimensions`);
    }
  }
  console.log(
    `PASS preview images: ${previewImages.length} static 1200x630 PNG routes were prerendered`,
  );
}

async function main() {
  await checkPreviewImages();

  const server = createStaticExportServer({
    redirects: await loadRedirects(redirectsPath),
    root: exportRoot,
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Failed to resolve local server port");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await runValidation({
      baseUrl,
      concurrency: 8,
      exportRoot,
      redirectsPath,
      timeoutMs: 15_000,
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
