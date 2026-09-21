// Static server that mirrors what Cloudflare actually sends: compressed text,
// correct content types, and the generated _headers rules. Measuring Lighthouse
// against an uncompressed server makes FCP meaningless.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, extname } from 'node:path';

const ROOT = '/home/user/System-formation/dist';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json' };
const COMPRESS = new Set(['.html', '.css', '.js', '.json', '.svg', '.xml', '.txt', '.webmanifest']);

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    let file = join(ROOT, path);
    const info = await stat(file).catch(() => null);
    if (!info || info.isDirectory()) file = join(ROOT, path, 'index.html');
    let body = await readFile(file);
    const ext = extname(file);
    const headers = { 'content-type': TYPES[ext] ?? 'application/octet-stream' };
    if (ext === '.html') headers['cache-control'] = 'public, max-age=0, must-revalidate';
    else headers['cache-control'] = 'public, max-age=31536000, immutable';
    if (COMPRESS.has(ext) && (req.headers['accept-encoding'] || '').includes('gzip')) {
      body = gzipSync(body, { level: 9 });
      headers['content-encoding'] = 'gzip';
    }
    headers['content-length'] = body.length;
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    const body = await readFile(join(ROOT, '404.html')).catch(() => 'Not found');
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(body);
  }
}).listen(4322, '127.0.0.1', () => console.log('serving dist on 4322 with gzip'));
