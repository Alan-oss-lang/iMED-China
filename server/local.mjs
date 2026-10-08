import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createLocalStorage } from './storage.mjs';
import { createLocalAuth } from './auth.mjs';
import { createApp, securityHeaders } from './app.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 8765);
const store = await createLocalStorage(resolve(root, process.env.IMED_DATA_FILE || 'var/imed.sqlite'));
const auth = createLocalAuth(), app = createApp({ store, auth });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.pdf': 'application/pdf' };
const server = createServer(async (incoming, outgoing) => {
  try {
    const origin = `http://${host.includes(':') ? `[${host}]` : host}:${port}`;
    const url = new URL(incoming.url, origin);
    const path = decodeURIComponent(url.pathname);
    // Only public assets and the admin application are served as files. Never expose seed data, env files or SQLite.
    if (path.startsWith('/assets/') || path === '/admin' || path.startsWith('/admin/')) {
      const filename = resolve(root, '.' + (['/admin', '/admin/'].includes(path) ? '/admin/index.html' : path));
      const allowed = [resolve(root, 'assets') + sep, resolve(root, 'admin') + sep];
      if (path === '/assets/search-index.js' || !allowed.some(dir => filename.startsWith(dir)) || !types[extname(filename)] || !(await stat(filename).catch(() => null))?.isFile()) {
        outgoing.writeHead(404, securityHeaders); outgoing.end('文件不存在'); return;
      }
      if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405, securityHeaders); outgoing.end(); return; }
      outgoing.writeHead(200, { ...securityHeaders, 'Content-Type': types[extname(filename)], 'Cache-Control': 'no-cache' });
      outgoing.end(incoming.method === 'HEAD' ? undefined : await readFile(filename)); return;
    }
    const request = new Request(url, { method: incoming.method, headers: incoming.headers, ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}) });
    const response = await app(request, { address: incoming.socket.remoteAddress });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(400, securityHeaders); outgoing.end('请求无效'); }
});
server.listen(port, host, () => {
  console.log(`前台：http://${host}:${port}\n管理后台：http://${host}:${port}/admin/`);
  if (!auth.configured) console.log('本地管理员尚未配置。运行 npm run setup 创建账号后再启动。');
});
function stop() { server.close(() => { store.close(); process.exit(0); }); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
