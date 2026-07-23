import path from "node:path";
import { fileURLToPath } from "node:url";

import { createStaticExportServer, loadRedirects } from "./serve-static-export.mjs";
import { runValidation } from "./validate-deployment.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exportRoot = path.join(appRoot, "out");
const redirectsPath = path.join(appRoot, "redirects.json");

async function main() {
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
