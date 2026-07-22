import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "../..");
const redirects = JSON.parse(await readFile(path.join(appRoot, "redirects.json"), "utf8"));
const templatePath = path.join(
  repoRoot,
  "infrastructure/modules/cloudfront/redirect-function.js.tftpl",
);
const template = await readFile(templatePath, "utf8");
const rendered = template.replace("${redirect_map_json}", JSON.stringify(redirects));

if (rendered === template)
  throw new Error("CloudFront template lacks redirect_map_json placeholder");
const size = Buffer.byteLength(rendered);
if (size > 10 * 1024)
  throw new Error(`Rendered CloudFront Function is ${size} bytes (limit: 10240)`);

const handler = vm.runInNewContext(`${rendered}\nhandler`, Object.create(null), {
  filename: templatePath,
});

function invoke(uri) {
  return handler({ request: { headers: {}, method: "GET", querystring: {}, uri } });
}

const failures = [];
for (const [source, destination] of Object.entries(redirects)) {
  for (const uri of source === "/" ? [source] : [source, `${source}/`]) {
    const result = invoke(uri);
    if (result.statusCode !== 301 || result.headers?.location?.value !== destination) {
      failures.push(`${uri}: expected 301 ${destination}, received ${JSON.stringify(result)}`);
    }
  }
}

for (const [uri, expected] of [
  ["/", "/index.html"],
  ["/guide", "/guide.html"],
  ["/guide/", "/guide.html"],
  ["/api/search", "/api/search"],
  ["/guide.html", "/guide.html"],
  ["/img/logo.png", "/img/logo.png"],
]) {
  const result = invoke(uri);
  if (result.statusCode || result.uri !== expected) {
    failures.push(`${uri}: expected request URI ${expected}, received ${JSON.stringify(result)}`);
  }
}

if (failures.length) {
  for (const failure of failures.slice(0, 30)) console.error(`FAIL ${failure}`);
  if (failures.length > 30) console.error(`...and ${failures.length - 30} more`);
  throw new Error(`${failures.length} CloudFront routing assertion(s) failed`);
}

console.log(
  `CloudFront routing checks passed: ${Object.keys(redirects).length} redirects (+ trailing slashes), clean URLs, extensionless search index, and assets; ${size} bytes rendered.`,
);
