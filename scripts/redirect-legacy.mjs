import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const destination = 'https://daniel-medina-fpga.m-daniel.chatgpt.site/blog';

async function redirectHtml(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await redirectHtml(file);
      continue;
    }
    if (!entry.name.endsWith('.html')) continue;
    const relative = path.relative(root, file).replaceAll(path.sep, '/');
    const route = relative === 'index.html' ? '/' : `/${relative}`;
    const target = `${destination}${route}`;
    const safeTarget = target.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RTLwise se ha trasladado</title><link rel="canonical" href="${safeTarget}"><meta http-equiv="refresh" content="0;url=${safeTarget}"><script>location.replace(${JSON.stringify(target)})</script></head><body><p>RTLwise está ahora en <a href="${safeTarget}">${safeTarget}</a>.</p></body></html>`;
    await writeFile(file, html);
  }
}

await redirectHtml(root);
