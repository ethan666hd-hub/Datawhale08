import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";

const BASE_PATH = "/daily-v8";
const PUBLIC_ROOT = process.env.STATIC_ROOT
  ? resolve(process.env.STATIC_ROOT)
  : join(import.meta.dirname, "public");
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(body);
}

createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  } catch {
    send(response, 400, "Bad request");
    return;
  }

  if (pathname === BASE_PATH) {
    send(response, 308, "Permanent redirect", { Location: `${BASE_PATH}/` });
    return;
  }
  if (!pathname.startsWith(`${BASE_PATH}/`)) {
    send(response, 404, "Not found");
    return;
  }

  let relativePath = pathname.slice(BASE_PATH.length + 1);
  if (!relativePath || relativePath.endsWith("/")) relativePath += "index.html";
  const normalizedPath = normalize(relativePath);
  const filePath = join(PUBLIC_ROOT, normalizedPath);
  if (normalizedPath.startsWith("..") || !filePath.startsWith(`${PUBLIC_ROOT}${sep}`)) {
    send(response, 404, "Not found");
    return;
  }

  try {
    const file = await stat(filePath);
    if (!file.isFile()) throw new Error("not_file");
    const extension = extname(filePath).toLowerCase();
    const isHtml = extension === ".html";
    response.writeHead(200, {
      "Cache-Control": isHtml ? "no-cache" : "public, max-age=3600",
      "Content-Length": file.size,
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    await pipeline(createReadStream(filePath), response);
  } catch {
    if (!response.headersSent) send(response, 404, "Not found");
  }
}).listen(PORT, HOST, () => {
  console.log(`Datawhale daily-v8 listening on ${HOST}:${PORT}`);
});
