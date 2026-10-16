/**
 * DCATS — internal app:// protocol for the packaged desktop build.
 * Serves dist/ over a privileged scheme so the renderer gets a standard,
 * secure origin: ES module imports, fetch() of the ONNX model and the
 * onnxruntime WASM, localStorage/IndexedDB all behave exactly as they do
 * over http(s) — with zero network access (no localhost server, no file://
 * fetch restrictions).
 */
const { protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.resolve(__dirname, '..', 'dist');
const SCHEME = 'app';
const HOST = 'dcats';

// Must run before the app is ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.onnx': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Register the handler that maps app://dcats/<path> to dist/<path>. */
function registerAppProtocolHandler() {
  protocol.handle(SCHEME, async (request) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    if (pathname === '/' || pathname === '') pathname = '/index.html';

    const filePath = path.resolve(DIST, '.' + pathname);
    const indexFile = path.join(DIST, 'index.html');
    if (filePath !== indexFile && !filePath.startsWith(DIST + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const data = await fs.promises.readFile(filePath);
      return new Response(data, {
        headers: {
          'content-type':
            MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

module.exports = {
  registerAppProtocolHandler,
  APP_URL: `${SCHEME}://${HOST}/index.html`,
};
