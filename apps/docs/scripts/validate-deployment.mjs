import { oramaStaticClient } from "fumadocs-core/search/client/orama-static";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "../..");
const defaultExportRoot = path.join(appRoot, "out");
const defaultRedirectsPath = path.join(appRoot, "redirects.json");

const apiMarkers = [
  {
    markers: ["REST API", "/v1/experiments", "GET"],
    route: "/api/rest",
  },
  {
    markers: [
      "openJII MQTT API (AWS IoT Core)",
      "/v1/{experimentId}/{sensorType}/{sensorVersion}/{sensorId}/{protocolId}",
      "Experiment Data Ingestion Message",
    ],
    route: "/api/mqtt",
  },
];

const searchSamples = [
  { expected: "/guide/devices-protocols/multispeq", term: "Bluetooth Classic" },
  { expected: "/guide/experiments/workbooks", term: "workbook" },
  { expected: "/developers/architecture/medallion-layers", term: "medallion" },
];

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.DOCS_BASE_URL ?? "http://127.0.0.1:3010",
    concurrency: 8,
    exportRoot: defaultExportRoot,
    redirectsPath: defaultRedirectsPath,
    timeoutMs: 15_000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--") continue;
    if (argument === "--base-url" && value) options.baseUrl = value;
    else if (argument === "--concurrency" && value) {
      options.concurrency = Number.parseInt(value, 10);
    } else if (argument === "--export-root" && value) options.exportRoot = path.resolve(value);
    else if (argument === "--redirects" && value) options.redirectsPath = path.resolve(value);
    else if (argument === "--timeout-ms" && value) options.timeoutMs = Number.parseInt(value, 10);
    else if (argument === "--help") {
      console.log(`Usage: node scripts/validate-deployment.mjs [options]

Options:
  --base-url <origin>      Docs origin (default: DOCS_BASE_URL or http://127.0.0.1:3010)
  --concurrency <number>   Maximum concurrent requests (default: 8)
  --export-root <path>     Built export used as the route inventory (default: apps/docs/out)
  --redirects <path>       Redirect manifest (default: apps/docs/redirects.json)
  --timeout-ms <number>    Per-request timeout (default: 15000)`);
      return null;
    } else if (!argument.startsWith("--") && index === 0) options.baseUrl = argument;
    else throw new Error(`Unknown or incomplete argument: ${argument}`);

    if (argument.startsWith("--") && argument !== "--help") index += 1;
  }

  if (
    !Number.isInteger(options.concurrency) ||
    options.concurrency < 1 ||
    options.concurrency > 32
  ) {
    throw new Error(`Invalid concurrency: ${options.concurrency}`);
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100) {
    throw new Error(`Invalid timeout: ${options.timeoutMs}`);
  }
  return options;
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Base URL must use http or https: ${value}`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      `Base URL must be a plain origin without credentials, query, or fragment: ${value}`,
    );
  }
  if (url.pathname !== "/") {
    throw new Error(`Base URL must not include a path: ${value}`);
  }
  return new URL(url.origin);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else files.push(absolute);
  }
  return files;
}

async function exportedRoutes(exportRoot) {
  let files;
  try {
    files = await walk(exportRoot);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`${exportRoot} is missing; build the docs before running the gate`);
    }
    throw error;
  }

  const routes = files
    .filter((file) => file.endsWith(".html"))
    .map((file) => ({
      file,
      relative: path.relative(exportRoot, file).split(path.sep).join("/"),
    }))
    .filter(({ relative }) => relative !== "404.html" && relative !== "_not-found.html")
    .map(({ file, relative }) => ({
      file,
      route: relative === "index.html" ? "/" : `/${relative.slice(0, -5)}`,
    }));

  if (routes.length === 0) throw new Error(`${exportRoot} contains no exported HTML routes`);
  return routes.sort((left, right) => left.route.localeCompare(right.route));
}

function decodeHtmlAttribute(value) {
  // "&amp;" must decode last so "&amp;quot;" yields the literal "&quot;".
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&");
}

function internalTargets(html, pageUrl, origin) {
  const targets = [];
  const attributes = html.matchAll(
    /<([a-z][\w:-]*)\b[^>]*?\b(href|src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
  );

  for (const match of attributes) {
    const raw = decodeHtmlAttribute(match[3] ?? match[4] ?? "").trim();
    if (!raw || raw.startsWith("#") || /^(?:data|javascript|mailto|tel):/i.test(raw)) {
      continue;
    }

    let url;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      targets.push({ invalid: raw, page: pageUrl.href });
      continue;
    }
    if (url.origin !== origin) continue;
    url.hash = "";
    targets.push({
      kind: match[1].toLowerCase() === "a" ? "page" : "asset",
      page: pageUrl.href,
      url,
    });
  }
  return targets;
}

async function mapLimit(values, concurrency, task) {
  const results = new Array(values.length);
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await task(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return results;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request(url, { method = "GET", timeoutMs }) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "openjii-docs-validation-gate/1.0" },
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await response.body?.cancel();
        await delay(250 * 2 ** attempt);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await delay(250 * 2 ** attempt);
    }
  }
  throw new Error(`Request failed after 3 attempts: ${url}`, { cause: lastError });
}

function formatErrors(errors, limit = 30) {
  const displayed = errors.slice(0, limit);
  if (errors.length > limit) displayed.push(`...and ${errors.length - limit} more`);
  return displayed.map((error) => `  - ${error}`).join("\n");
}

async function checkRoutesAndLinks({ baseUrl, concurrency, exportRoot, timeoutMs }) {
  const routes = await exportedRoutes(exportRoot);
  const routeUrls = new Set(routes.map(({ route }) => new URL(route, baseUrl).href));
  const targets = new Map();
  const errors = [];

  await mapLimit(routes, concurrency, async ({ file, route }) => {
    const url = new URL(route, baseUrl);
    let response;
    try {
      response = await request(url, { timeoutMs });
    } catch (error) {
      errors.push(`${route}: ${error.message}`);
      return;
    }
    if (response.status !== 200) {
      errors.push(`${route}: expected 200, received ${response.status}`);
      await response.body?.cancel();
      return;
    }
    const html = await response.text();
    if (!/<html\b/i.test(html)) errors.push(`${route}: response is not an HTML document`);
    const expectedHtml = await readFile(file, "utf8");
    if (html !== expectedHtml) errors.push(`${route}: response body differs from the built export`);
    for (const target of internalTargets(html, url, baseUrl.origin)) {
      if (target.invalid) {
        errors.push(`${route}: invalid internal URL ${target.invalid}`);
      } else {
        targets.set(target.url.href, target);
      }
    }
  });

  const remainingTargets = [...targets.values()].filter(
    (target) => !routeUrls.has(target.url.href),
  );
  await mapLimit(remainingTargets, concurrency, async (target) => {
    let response;
    try {
      response = await request(target.url, { method: "HEAD", timeoutMs });
      if (response.status === 405) response = await request(target.url, { timeoutMs });
    } catch (error) {
      errors.push(`${target.page} -> ${target.url.href}: ${error.message}`);
      return;
    }
    if (response.status !== 200) {
      errors.push(`${target.page} -> ${target.url.href}: received ${response.status}`);
    }
    await response.body?.cancel();
  });

  if (errors.length) {
    throw new Error(`${errors.length} route/internal-link failure(s):\n${formatErrors(errors)}`);
  }
  return `${routes.length} exported HTML routes, ${targets.size} unique internal targets`;
}

async function checkRedirects({ baseUrl, concurrency, redirectsPath, timeoutMs }) {
  const redirects = JSON.parse(await readFile(redirectsPath, "utf8"));
  const entries = Object.entries(redirects);
  const errors = [];

  await mapLimit(entries, concurrency, async ([source, destination]) => {
    const sourceUrl = new URL(source, baseUrl);
    const expectedUrl = new URL(destination, baseUrl);
    let response;
    try {
      response = await request(sourceUrl, { timeoutMs });
    } catch (error) {
      errors.push(`${source}: ${error.message}`);
      return;
    }

    const location = response.headers.get("location");
    if (response.status !== 301) {
      errors.push(`${source}: expected 301, received ${response.status}`);
    } else if (!location) {
      errors.push(`${source}: 301 response has no Location header`);
    } else {
      const actualUrl = new URL(location, sourceUrl);
      if (actualUrl.href !== expectedUrl.href) {
        errors.push(`${source}: expected Location ${expectedUrl.href}, received ${actualUrl.href}`);
      }
    }
    await response.body?.cancel();

    let destinationResponse;
    try {
      destinationResponse = await request(expectedUrl, { timeoutMs });
    } catch (error) {
      errors.push(`${source} -> ${destination}: ${error.message}`);
      return;
    }
    if (destinationResponse.status !== 200) {
      errors.push(
        `${source} -> ${destination}: expected destination 200, received ${destinationResponse.status}`,
      );
    }
    await destinationResponse.body?.cancel();
  });

  if (errors.length) {
    throw new Error(`${errors.length} redirect failure(s):\n${formatErrors(errors)}`);
  }
  return `${entries.length} legacy routes returned exact 301 destinations and destination 200s`;
}

async function checkNotFound({ baseUrl, timeoutMs }) {
  const route = `/__docs-validation__/missing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await request(new URL(route, baseUrl), { timeoutMs });
  const body = await response.text();
  if (response.status !== 404) {
    throw new Error(`${route}: expected 404, received ${response.status}`);
  }
  if (!/404|page could not be found/i.test(body)) {
    throw new Error(`${route}: response lacks a meaningful 404 marker`);
  }
  return "unknown clean URL returned the exported 404 page with HTTP 404";
}

async function checkApiContent({ baseUrl, timeoutMs }) {
  for (const { route, markers } of apiMarkers) {
    const response = await request(new URL(route, baseUrl), { timeoutMs });
    const body = await response.text();
    if (response.status !== 200) {
      throw new Error(`${route}: expected 200, received ${response.status}`);
    }
    const missing = markers.filter((marker) => !body.includes(marker));
    if (missing.length) {
      throw new Error(`${route}: missing content marker(s): ${missing.join(", ")}`);
    }
  }
  return `${apiMarkers.length} generated references contain REST/MQTT contract markers`;
}

async function checkSearch({ baseUrl, timeoutMs }) {
  const indexUrl = new URL("/api/search", baseUrl).href;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init = {}) =>
    originalFetch(input, {
      ...init,
      headers: {
        "user-agent": "openjii-docs-validation-gate/1.0",
        ...init.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

  try {
    const client = oramaStaticClient({ from: indexUrl });
    for (const { expected, term } of searchSamples) {
      const results = await client.search(term);
      if (
        !results.some((result) => result.url === expected || result.url.startsWith(`${expected}#`))
      ) {
        throw new Error(
          `search for ${JSON.stringify(term)} did not return ${expected}; got ${results
            .slice(0, 5)
            .map((result) => result.url)
            .join(", ")}`,
        );
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  return `${searchSamples.length} Orama queries returned the expected Guide/Developers pages`;
}

async function productionWebFiles() {
  const roots = [path.join(repoRoot, "apps/web/app"), path.join(repoRoot, "apps/web/components")];
  const files = [];
  for (const root of roots) files.push(...(await walk(root)));
  return files.filter(
    (file) =>
      /\.(?:ts|tsx)$/.test(file) &&
      !/\.(?:test|spec|stories)\.(?:ts|tsx)$/.test(file) &&
      !file.includes(`${path.sep}graphify-out${path.sep}`),
  );
}

async function discoverWebDeepLinks() {
  const paths = new Map();
  const hardCoded = [];
  for (const file of await productionWebFiles()) {
    const source = await readFile(file, "utf8");
    const hardCodedMatches = [...source.matchAll(/https:\/\/docs\.openjii\.org[^\s"'`)\]}]*/g)];
    if (!source.includes("NEXT_PUBLIC_DOCS_URL") && hardCodedMatches.length === 0) continue;
    const relative = path.relative(repoRoot, file).split(path.sep).join("/");

    for (const match of source.matchAll(/\$\{env\.NEXT_PUBLIC_DOCS_URL\}([^`$\s"'<>)]*)/g)) {
      const suffix = match[1] || "/";
      if (!suffix.startsWith("/")) {
        throw new Error(`${relative}: unsupported NEXT_PUBLIC_DOCS_URL suffix ${suffix}`);
      }
      if (!paths.has(suffix)) paths.set(suffix, []);
      paths.get(suffix).push(relative);
    }
    if (/\benv\.NEXT_PUBLIC_DOCS_URL\b/.test(source)) {
      if (!paths.has("/")) paths.set("/", []);
      paths.get("/").push(relative);
    }
    for (const match of hardCodedMatches) {
      hardCoded.push(`${relative}: ${match[0]}`);
    }
  }
  if (hardCoded.length) {
    throw new Error(`hard-coded production docs origins remain:\n${formatErrors(hardCoded)}`);
  }
  if (paths.size === 0) throw new Error("no NEXT_PUBLIC_DOCS_URL consumers found in the web app");
  return paths;
}

async function checkWebDeepLinks({ baseUrl, concurrency, timeoutMs }) {
  const paths = await discoverWebDeepLinks();
  const errors = [];
  await mapLimit([...paths.entries()], concurrency, async ([pathname, sources]) => {
    let response;
    try {
      response = await request(new URL(pathname, baseUrl), { timeoutMs });
    } catch (error) {
      errors.push(`${pathname} (${sources.join(", ")}): ${error.message}`);
      return;
    }
    if (response.status !== 200) {
      errors.push(`${pathname} (${sources.join(", ")}): received ${response.status}`);
    }
    await response.body?.cancel();
  });
  if (errors.length) {
    throw new Error(`${errors.length} web deep-link failure(s):\n${formatErrors(errors)}`);
  }
  return `${paths.size} unique destinations derived from production web-app source`;
}

export async function runValidation(options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const checks = [
    ["routes + internal links", checkRoutesAndLinks],
    ["legacy redirects", checkRedirects],
    ["real 404", checkNotFound],
    ["generated API references", checkApiContent],
    ["static search", checkSearch],
    ["web-app deep links", checkWebDeepLinks],
  ];
  const failures = [];

  console.log(`Validating docs origin ${baseUrl.origin}`);
  for (const [label, check] of checks) {
    try {
      const summary = await check({ ...options, baseUrl });
      console.log(`PASS ${label}: ${summary}`);
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
      console.error(`FAIL ${label}: ${error.message}`);
    }
  }

  if (failures.length) {
    throw new Error(
      `Documentation validation gate failed (${failures.length}/${checks.length} checks failed)`,
    );
  }
  console.log(`Documentation validation gate passed for ${baseUrl.origin}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options) return;
  await runValidation(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
