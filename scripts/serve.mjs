import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const buildScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "build.mjs");
const port = Number(process.env.RTLWISE_PORT || 4173);

execFileSync(process.execPath, [buildScript], { stdio: "inherit" });

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

const server = http.createServer(async (request, response) => {
  try {
    const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\//, "");
    let filePath = path.resolve(root, relativePath);
    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    try {
      await access(filePath);
    } catch {
      filePath = path.join(root, "404.html");
    }
    response.writeHead(filePath.endsWith("404.html") ? 404 : 200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
  }
});

server.listen(port, () => {
  console.log(`→ RTLwise listo en http://localhost:${port}`);
  console.log("  Edita content/posts/*.md y vuelve a ejecutar npm run build para regenerar el sitio.");
});
