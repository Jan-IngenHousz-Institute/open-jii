import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
  [".yaml", "application/yaml; charset=utf-8"],
  [".yml", "application/yaml; charset=utf-8"],
]);

function parseArgs(argv) {
  const options = {
    host: "127.0.0.1",
    port: 3010,
    redirectsPath: path.join(appRoot, "redirects.json"),
    root: path.join(appRoot, "out"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--") continue;
    if (argument === "--host" && value) options.host = value;
    else if (argument === "--port" && value) options.port = Number.parseInt(value, 10);
    else if (argument === "--root" && value) options.root = path.resolve(value);
    else if (argument === "--redirects" && value) options.redirectsPath = path.resolve(value);
    else if (argument === "--help") {
      console.log(`Usage: node scripts/serve-static-export.mjs [options]

Options:
  --host <host>          Bind host (default: 127.0.0.1)
  --port <port>          Bind port (default: 3010; use 0 for a random free port)
  --root <directory>     Static export directory (default: apps/docs/out)
  --redirects <file>     Redirect manifest (default: apps/docs/redirects.json)`);
      return null;
    } else throw new Error(`Unknown or incomplete argument: ${argument}`);

    if (argument !== "--help") index += 1;
  }

  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65_535) {
    throw new Error(`Invalid port: ${options.port}`);
  }
  return options;
}

function redirectKey(pathname) {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function objectPathForRequest(pathname) {
  if (pathname === "/") return "/index.html";

  // Next exports the Orama index as a real extensionless object. CloudFront
  // must pass this one path through instead of applying the clean-URL rewrite.
  if (pathname === "/api/search") return pathname;

  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (lastSegment.includes(".")) return pathname;
  return `${pathname.endsWith("/") ? pathname.slice(0, -1) : pathname}.html`;
}

async function sendFile(request, response, file, statusCode = 200) {
  const metadata = await stat(file);
  if (!metadata.isFile()) throw new Error(`${file} is not a file`);

  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-length": metadata.size,
    "content-type":
      contentTypes.get(path.extname(file).toLowerCase()) ?? "application/octet-stream",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
}

export async function loadRedirects(redirectsPath = path.join(appRoot, "redirects.json")) {
  return JSON.parse(await readFile(redirectsPath, "utf8"));
}

export function createStaticExportServer({ root, redirects }) {
  const exportRoot = path.resolve(root);
  const rootPrefix = `${exportRoot}${path.sep}`;

  return createServer(async (request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, {
          allow: "GET, HEAD",
          "content-type": "text/plain; charset=utf-8",
        });
        response.end("Method Not Allowed");
        return;
      }

      const url = new URL(request.url ?? "/", "http://localhost");
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        response.end("Bad Request");
        return;
      }

      const destination = redirects[redirectKey(pathname)];
      if (destination) {
        response.writeHead(301, { location: destination });
        response.end();
        return;
      }

      const objectPath = objectPathForRequest(pathname);
      const file = path.resolve(exportRoot, `.${objectPath}`);
      if (file !== exportRoot && !file.startsWith(rootPrefix)) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        response.end("Bad Request");
        return;
      }

      try {
        await sendFile(request, response, file);
      } catch (error) {
        if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
        const notFound = path.join(exportRoot, "404.html");
        try {
          await sendFile(request, response, notFound, 404);
        } catch (notFoundError) {
          if (notFoundError?.code !== "ENOENT") throw notFoundError;
          response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          response.end("404: This page could not be found.");
        }
      }
    } catch (error) {
      console.error(error);
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      }
      response.end("Internal Server Error");
    }
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options) return;
  const redirects = await loadRedirects(options.redirectsPath);
  const server = createStaticExportServer({ root: options.root, redirects });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port;
  console.log(`Docs static export server listening on http://${options.host}:${port}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
