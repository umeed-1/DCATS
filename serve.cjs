#!/usr/bin/env node
/**
 * DCATS — static server for the built web bundle (dist/).
 * Zero dependencies: the Dockerfile runtime stage cannot `npm ci` the full
 * dependency tree (vite is a devDependency), and the app is a HashRouter SPA,
 * so a plain file server with a correct MIME table is all the preview needs.
 *
 * Env: PORT (default 4173), HOST (default 0.0.0.0), DIST (default ./dist)
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.resolve(__dirname, process.env.DIST || 'dist');
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const INDEX = path.join(DIST, 'index.html');

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Bad request');
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  // Same traversal guard shape as electron/protocol.cjs.
  const filePath = path.resolve(DIST, '.' + pathname);
  if (filePath !== INDEX && !filePath.startsWith(DIST + path.sep)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`DCATS web bundle serving ${DIST} at http://${HOST}:${PORT}`);
});
