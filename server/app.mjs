import { randomUUID } from 'node:crypto';
import { collections, HttpError, validateRecord, visible, publicSummary } from './content.mjs';
import { verifyOrigin } from './auth.mjs';
import { renderPage, searchRecords } from './render.mjs';
import templates from '../content/templates.json' with { type: 'json' };

export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
};
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
async function body(request, limit = 500000) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, '请使用 JSON 格式提交内容');
  const bytes = await readLimited(request, limit);
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HttpError(400, '提交的 JSON 格式无效'); }
}
async function readLimited(request, limit) {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new HttpError(413, '提交内容超出大小限制');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new HttpError(413, '提交内容超出大小限制'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
function imageType(bytes) {
  const b = Buffer.from(bytes);
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (b.length >= 12 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b.length >= 12 && ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6))) return 'image/gif';
  if (b.length >= 16 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new HttpError(415, '仅支持 PNG、JPEG、GIF 或 WebP 图片');
}
const cookie = (token, url, clear = false) => `imed_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear ? '0' : '28800'}${url.protocol === 'https:' ? '; Secure' : ''}`;
function checkRevision(request, previous) {
  // A CDN may consume HTTP conditional headers before invoking the function.
  const revision = request.headers.get('x-imed-revision');
  const match = revision === null ? request.headers.get('if-match') : `"${revision}"`;
  if (!match) throw new HttpError(428, '请先读取最新内容再进行修改');
  if (match !== `"${previous.revision}"`) throw new HttpError(409, '该内容已被修改，请重新加载后再保存');
}
export function createApp({ store, auth, logger = console }) {
  return async function handler(request, context = {}) {
    const requestId = randomUUID();
    try {
      const url = new URL(request.url), path = url.pathname, method = request.method;
      if (!path.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(method)) throw new HttpError(405, '请求方法不支持');
        const { state } = await store.read(), page = renderPage(url, state);
        if (page.location) return new Response(null, { status: page.status, headers: { ...securityHeaders, Location: page.location, 'Cache-Control': 'no-store' } });
        return new Response(method === 'HEAD' ? null : page.html, { status: page.status, headers: { ...securityHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      }
      const parts = path.slice(5).split('/').filter(Boolean);
      if (path === '/api/health' && method === 'GET') { await store.read(); return json({ ok: true, service: 'iMED CMS', schemaVersion: 1 }); }
      if (path === '/api/auth/config' && method === 'GET') return json({ mode: auth.mode, configured: auth.configured });
      if (path === '/api/auth/login' && method === 'POST') {
        verifyOrigin(request, { required: true });
        if (auth.mode !== 'local') throw new HttpError(405, '线上请通过 Netlify Identity 登录');
        const result = await auth.login(await body(request, 4000), context.address);
        return json({ user: result.user }, 200, { 'Set-Cookie': cookie(result.token, url) });
      }
      if (path === '/api/auth/logout' && method === 'POST') {
        verifyOrigin(request, { required: true });
        return json({ ok: true }, 200, { 'Set-Cookie': cookie('', url, true) });
      }
      if (path === '/api/auth/me' && method === 'GET') return json({ user: await auth.user(request) });
      if (parts[0] === 'media' && parts.length === 2 && ['GET', 'HEAD'].includes(method)) {
        if (!/^[a-f0-9-]{36}$/.test(parts[1])) throw new HttpError(404, '图片不存在');
        const media = await store.getMedia(parts[1]);
        if (!media) throw new HttpError(404, '图片不存在');
        return new Response(method === 'HEAD' ? null : media.data, { headers: { ...securityHeaders, 'Content-Type': media.metadata.contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Disposition': 'inline' } });
      }
      if (parts[0] !== 'admin') {
        if (method !== 'GET') throw new HttpError(405, '请求方法不支持');
        const { state } = await store.read();
        if (path === '/api/search') {
          const q = (url.searchParams.get('q') || '').trim();
          if (q.length > 200) throw new HttpError(400, '搜索关键词过长');
          return json(q ? searchRecords(state, q) : { items: [], total: 0 });
        }
        if (parts[0] === 'content' && collections.includes(parts[1])) {
          if (parts.length === 3) {
            const record = state.collections[parts[1]][parts[2]];
            if (!record || record.status !== 'published') throw new HttpError(404, '内容不存在或尚未发布');
            return json({ item: record });
          }
          if (parts.length === 2) return json({ items: visible(state, parts[1]).map(publicSummary) });
        }
        throw new HttpError(404, '接口不存在');
      }
      const user = await auth.user(request);
      if (!['GET', 'HEAD'].includes(method)) verifyOrigin(request, { required: auth.mode === 'local' });
      const { state, etag } = await store.read();
      if (path === '/api/admin/dashboard' && method === 'GET') return json({ counts: Object.fromEntries(collections.map(c => [c, { total: Object.keys(state.collections[c]).length, published: visible(state, c).length }])), history: state.history.slice(-20).reverse(), media: Object.values(state.media).slice(-50).reverse() });
      if (path === '/api/admin/export' && method === 'GET') return json(state, 200, { 'Content-Disposition': 'attachment; filename="imed-content-backup.json"' });
      const audit = (action, collection, item) => {
        state.version += 1;
        state.history.push({ id: randomUUID(), at: new Date().toISOString(), action, collection, itemId: item.id, title: item.title || item.name, user: user.name });
        state.history = state.history.slice(-200);
      };
      if (path === '/api/admin/media' && method === 'POST') {
        const bytes = await readLimited(request, 4 * 1024 * 1024);
        const contentType = imageType(bytes), id = randomUUID();
        let name; try { name = decodeURIComponent(request.headers.get('x-file-name') || '图片'); } catch { throw new HttpError(400, '图片文件名无效'); }
        const metadata = { id, name: name.slice(0, 150), contentType, size: bytes.length, url: `/api/media/${id}`, createdAt: new Date().toISOString() };
        await store.putMedia(id, bytes, metadata);
        state.media[id] = metadata; audit('upload', 'media', metadata); await store.write(state, etag);
        return json({ item: metadata }, 201);
      }
      const collection = parts[1], id = parts[2];
      if (!collections.includes(collection) || parts.length > 3) throw new HttpError(404, '接口不存在');
      if (method === 'GET') {
        if (id) {
          const item = state.collections[collection][id]; if (!item) throw new HttpError(404, '内容不存在');
          return json({ item }, 200, { ETag: `"${item.revision}"` });
        }
        const q = (url.searchParams.get('q') || '').toLowerCase().trim(), status = url.searchParams.get('status');
        const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
        const limit = Math.max(1, Math.min(100, Math.floor(Number(url.searchParams.get('limit')) || 20)));
        const items = Object.values(state.collections[collection]).filter(r => (!q || `${r.title} ${r.category || ''} ${r.englishName || ''}`.toLowerCase().includes(q)) && (!status || status === r.status)).sort(collection === 'news' ? (a, b) => b.date.localeCompare(a.date) : (a, b) => (a.order || 0) - (b.order || 0) || a.title.localeCompare(b.title, 'zh-CN'));
        return json({ items: items.slice((page - 1) * limit, page * limit).map(r => ({ ...publicSummary(r), revision: r.revision, updatedAt: r.updatedAt })), total: items.length, page, limit });
      }
      if (method === 'POST' && !id || method === 'PUT' && id) {
        const previous = id ? state.collections[collection][id] : undefined;
        if (id && !previous) throw new HttpError(404, '内容不存在');
        if (previous) checkRevision(request, previous);
        const item = validateRecord(collection, await body(request), previous);
        if (collection === 'pages') {
          if (item.slug === 'index.html' && item.status !== 'published') throw new HttpError(400, '首页须保持发布状态');
          if (Object.keys(templates.lists).includes(item.slug) || ['article.html', '404.html'].includes(item.slug) || templates.aliases[item.slug] || Object.values(state.collections.pages).some(p => p.id !== item.id && p.slug === item.slug) || Object.values(state.collections.news).some(p => p.url === item.slug)) throw new HttpError(400, '此页面地址已被占用');
        }
        state.collections[collection][item.id] = item; audit(previous ? 'update' : 'create', collection, item);
        await store.write(state, etag); return json({ item }, previous ? 200 : 201, { ETag: `"${item.revision}"` });
      }
      if (method === 'DELETE' && id) {
        const item = state.collections[collection][id]; if (!item) throw new HttpError(404, '内容不存在');
        checkRevision(request, item);
        if (collection === 'pages' && item.slug === 'index.html') throw new HttpError(400, '首页不能删除');
        delete state.collections[collection][id]; audit('delete', collection, item);
        await store.write(state, etag); return json({ ok: true });
      }
      throw new HttpError(405, '请求方法不支持');
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) logger.error('iMED request failed', { requestId, message: error.message });
      return json({ error: status === 500 ? '服务暂时不可用，请稍后重试' : error.message, requestId }, status);
    }
  };
}
