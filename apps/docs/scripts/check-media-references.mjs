/**
 * Every media path referenced from content must exist under public/, and every
 * published web capture must sit on the frame documented in media/web/README.md.
 *
 * The link crawler only follows anchors, so a renamed or mistyped image survives
 * a green build and 404s in the browser. This is the cheap guard against that.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Desktop web captures publish on one real desktop frame: 1920x1200, 16:10.
 * Only formats whose header this script can read are checked, so recordings are
 * covered by review rather than here; apps/docs/media/web/manifest.json lists
 * the ones still carrying a pre-refresh frame.
 */
const STANDARD_FRAME = { height: 1200, width: 1920 };
const STANDARDIZED_DIRECTORIES = ["img/chrome-refresh", "img/workbooks"];

const MEDIA_PATTERN = /["'(](\/img\/[^"')\s]+)/g;
const MEDIA_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".mp4",
  ".png",
  ".svg",
  ".webm",
  ".webp",
]);

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** Reads intrinsic dimensions from a WebP (VP8/VP8L/VP8X) or PNG header. */
async function readDimensions(file) {
  const bytes = await readFile(file);
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    const chunk = bytes.subarray(12, 16).toString("ascii");
    if (chunk === "VP8X")
      return { height: 1 + bytes.readUIntLE(27, 3), width: 1 + bytes.readUIntLE(24, 3) };
    if (chunk === "VP8 ")
      return { height: bytes.readUInt16LE(28) & 0x3fff, width: bytes.readUInt16LE(26) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return { height: ((bits >> 14) & 0x3fff) + 1, width: (bits & 0x3fff) + 1 };
    }
    return null;
  }
  if (bytes.subarray(1, 4).toString("ascii") === "PNG") {
    return { height: bytes.readUInt32BE(20), width: bytes.readUInt32BE(16) };
  }
  return null;
}

export async function checkMediaReferences({ appRoot, strict = false }) {
  const contentRoot = path.join(appRoot, "content");
  const publicRoot = path.join(appRoot, "public");
  const pending = JSON.parse(await readFile(path.join(appRoot, "media/pending.json"), "utf8"));
  const pendingByPath = new Map();
  for (const entry of pending) {
    if (
      !entry.path?.startsWith("/img/") ||
      entry.path.split("/").includes("..") ||
      !entry.staged?.startsWith("apps/docs/.capture/") ||
      !/^OJD-\d+$/.test(entry.ticket) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
      pendingByPath.has(entry.path)
    ) {
      throw new Error(`Invalid or duplicate pending media entry: ${entry.path}`);
    }
    pendingByPath.set(entry.path, entry);
  }
  const referenced = new Set();
  const missing = [];
  const problems = [];
  const exists = async (reference) =>
    stat(path.join(publicRoot, reference)).then(
      (entry) => entry.isFile(),
      () => false,
    );

  for await (const file of walk(contentRoot)) {
    if (!file.endsWith(".mdx") && !file.endsWith(".md")) continue;
    const source = await readFile(file, "utf8");
    for (const [, reference] of source.matchAll(MEDIA_PATTERN)) {
      if (!MEDIA_EXTENSIONS.has(path.extname(reference))) continue;
      referenced.add(reference);
      if (!(await exists(reference)) && !pendingByPath.has(reference)) {
        missing.push(`${path.relative(appRoot, file)} -> ${reference}`);
      }
    }
  }

  for (const entry of pending) {
    if (await exists(entry.path)) problems.push(`published; remove from pending: ${entry.path}`);
    else if (strict) problems.push(`pending publication: ${entry.path}`);
  }
  const offFrame = [];
  for (const directory of STANDARDIZED_DIRECTORIES) {
    for await (const file of walk(path.join(publicRoot, directory))) {
      if (path.extname(file) === ".svg") continue;
      const dimensions = await readDimensions(file);
      if (!dimensions) continue;
      if (
        dimensions.width !== STANDARD_FRAME.width ||
        dimensions.height !== STANDARD_FRAME.height
      ) {
        offFrame.push(
          `${path.relative(publicRoot, file)} is ${dimensions.width}x${dimensions.height}, expected ${STANDARD_FRAME.width}x${STANDARD_FRAME.height}`,
        );
      }
    }
  }
  problems.push(
    ...missing.map((entry) => `missing media: ${entry}`),
    ...offFrame.map((entry) => `off-frame capture: ${entry}`),
  );
  return { pending, problems, referenced: referenced.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = await checkMediaReferences({ appRoot, strict: process.argv.includes("--strict") });
  if (result.pending.length > 0) {
    console.log("Pending publication:");
    for (const entry of result.pending)
      console.log(`  ${entry.path} <- ${entry.staged} (${entry.ticket}, ${entry.date})`);
  }
  if (result.problems.length > 0) {
    console.error(result.problems.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      `Media reference check passed: ${result.referenced} references checked; ${result.pending.length} pending publication; every readable still in ${STANDARDIZED_DIRECTORIES.join(", ")} is ${STANDARD_FRAME.width}x${STANDARD_FRAME.height}.`,
    );
  }
}
