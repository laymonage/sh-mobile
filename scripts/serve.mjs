import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { input, readInput, ROOT } from '../src/inputs.mjs';

// A local-only server for the port. /dev-jar/<id> serves a pinned build, so the
// page can start with ?jar=<id> rather than a file picker.
const PORT = Number(process.env.PORT ?? 8123);
const WEB = join(ROOT, 'web');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function serveStatic(path, response) {
  const relative = normalize(decodeURIComponent(path)).replace(/^[/\\]+/, '') || 'index.html';
  const file = join(WEB, relative);
  if (!file.startsWith(WEB + sep) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  response.end(readFileSync(file));
}

createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  const jar = pathname.match(/^\/dev-jar\/(.+)$/);
  if (!jar) {
    serveStatic(pathname, response);
    return;
  }
  try {
    const id = decodeURIComponent(jar[1]);
    input(id);
    response.writeHead(200, { 'Content-Type': 'application/java-archive', 'Cache-Control': 'no-store' });
    response.end(readInput(id));
  } catch {
    response.writeHead(404).end('Unknown build');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`http://localhost:${PORT}/?jar=sh1-2007-a31`);
});
