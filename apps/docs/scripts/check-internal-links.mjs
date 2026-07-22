import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(appRoot, "out");

if (!fs.existsSync(outRoot)) {
  throw new Error("apps/docs/out is missing; run the docs build first");
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
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

function existsInExport(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  const relative = decoded.replace(/^\/+/, "");
  const base = path.join(outRoot, relative);
  const candidates =
    decoded === "/"
      ? [path.join(outRoot, "index.html")]
      : [base, `${base}.html`, path.join(base, "index.html")];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

const htmlFiles = walk(outRoot).filter((file) => file.endsWith(".html"));
const broken = [];
let checked = 0;

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const pageRoute = routeForHtml(file);
  const base = new URL(pageRoute, "https://docs.openjii.invalid");
  const attributes = html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi);
  for (const match of attributes) {
    const raw = match[1];
    if (!raw || raw.startsWith("#") || raw.startsWith("data:") || raw.startsWith("mailto:")) {
      continue;
    }
    let resolved;
    try {
      resolved = new URL(raw.replaceAll("&amp;", "&"), base);
    } catch {
      broken.push({ page: pageRoute, target: raw, reason: "invalid URL" });
      continue;
    }
    if (resolved.origin !== base.origin) continue;
    checked += 1;
    if (!existsInExport(resolved.pathname)) {
      broken.push({ page: pageRoute, target: raw, reason: "missing export target" });
    }
  }
}

if (broken.length) {
  for (const item of broken) {
    console.error(`BROKEN ${item.page} -> ${item.target} (${item.reason})`);
  }
  throw new Error(`${broken.length} broken internal link(s) found`);
}

console.log(
  `Internal-link crawl passed: ${htmlFiles.length} HTML files, ${checked} internal targets.`,
);
