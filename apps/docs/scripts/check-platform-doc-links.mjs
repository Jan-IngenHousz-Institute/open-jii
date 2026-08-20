/**
 * Every `DocsHelpLink` in the web app points at a docs page. This checks that the
 * page is actually there.
 *
 * `check-internal-links.mjs` cannot catch this: it crawls links *inside* the docs
 * export, and a CTA lives in `apps/web` and is only resolved in the browser at click
 * time. That gap is how two "Learn how" links shipped pointing at a route that did
 * not exist.
 *
 * Requires a built docs site — it reads the static export in `apps/docs/out`, so run
 * the docs build first. It cannot run standalone.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(appRoot, "out");
const webRoot = path.resolve(appRoot, "..", "web");

if (!fs.existsSync(outRoot)) {
  throw new Error("apps/docs/out is missing; run the docs build first");
}
if (!fs.existsSync(webRoot)) {
  throw new Error(`apps/web is missing at ${webRoot}`);
}

const SOURCE_DIRECTORIES = ["app", "components"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function routeForHtml(file) {
  const relative = path.relative(outRoot, file).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return `/${relative.slice(0, -"index.html".length)}`;
  return `/${relative.slice(0, -".html".length)}`;
}

const routes = new Set(
  walk(outRoot)
    .filter((file) => file.endsWith(".html"))
    .map(routeForHtml)
    .map((route) => (route.length > 1 && route.endsWith("/") ? route.slice(0, -1) : route)),
);

function existsInExport(pathname) {
  const withoutHash = pathname.split("#")[0].split("?")[0];
  const trimmed =
    withoutHash.length > 1 && withoutHash.endsWith("/") ? withoutHash.slice(0, -1) : withoutHash;
  return routes.has(trimmed) || routes.has(`${trimmed}/index`);
}

// Only the literal form is resolvable here. A computed `path` is reported as skipped
// rather than silently passed, so this never claims coverage it does not have.
const LITERAL_PATH = /<DocsHelpLink\b[^>]*?\bpath=(["'])(.*?)\1/gs;
const COMPUTED_PATH = /<DocsHelpLink\b[^>]*?\bpath=\{/gs;

const broken = [];
const skipped = [];
let checked = 0;

for (const directory of SOURCE_DIRECTORIES) {
  const absolute = path.join(webRoot, directory);
  if (!fs.existsSync(absolute)) continue;

  for (const file of walk(absolute)) {
    if (!SOURCE_EXTENSIONS.has(path.extname(file))) continue;
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes("DocsHelpLink")) continue;
    const page = path.relative(webRoot, file).split(path.sep).join("/");

    for (const match of source.matchAll(LITERAL_PATH)) {
      const target = match[2];
      checked += 1;
      if (!target.startsWith("/")) {
        broken.push({ page, target, reason: "not an absolute docs path" });
      } else if (!existsInExport(target)) {
        broken.push({ page, target, reason: "no such page in the docs export" });
      }
    }
    for (const _match of source.matchAll(COMPUTED_PATH)) {
      skipped.push(page);
    }
  }
}

if (broken.length) {
  for (const item of broken) {
    console.error(`BROKEN ${item.page} -> ${item.target} (${item.reason})`);
  }
  throw new Error(`${broken.length} platform documentation link(s) point at missing pages`);
}

if (skipped.length) {
  console.warn(
    `Skipped ${skipped.length} computed DocsHelpLink path(s), which cannot be resolved statically: ${[...new Set(skipped)].join(", ")}`,
  );
}

console.log(
  `Platform documentation links passed: ${checked} DocsHelpLink target(s) resolve against ${routes.size} exported routes.`,
);
