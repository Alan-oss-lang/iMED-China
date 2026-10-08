import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from 'cheerio';
import seed from '../content/seed.json' with { type: 'json' };
import templates from '../content/templates.json' with { type: 'json' };
import { createApp } from '../server/app.mjs';
import { createLocalStorage, BlobStorage } from '../server/storage.mjs';
import { createLocalAuth, createIdentityAuth, hashPassword } from '../server/auth.mjs';
import { validateRecord, collections } from '../server/content.mjs';
import { renderPage } from '../server/render.mjs';

const origin = 'http://localhost:8765';
const password = 'testing-password-8765';
const env = { IMED_ADMIN_USERNAME: 'test-admin', IMED_ADMIN_PASSWORD_HASH: hashPassword(password), IMED_SESSION_SECRET: 'a'.repeat(64) };
const newsInput = { title: '独立测试新闻 $&', date: '2027-01-02', category: '学术活动', summary: '新的发布内容', bodyHtml: '<p>新正文</p>', status: 'draft' };
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'imed-test-'));
  const store = await createLocalStorage(join(directory, 'db.sqlite'));
  const app = createApp({ store, auth: createLocalAuth(env) });
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true }); });
  let sessionCookie = '';
  async function request(path, method = 'GET', input, options = {}) {
    return app(new Request(origin + path, { method, headers: { Origin: origin, ...(sessionCookie ? { Cookie: sessionCookie } : {}), ...(input !== undefined ? { 'Content-Type': 'application/json' } : {}), ...options.headers }, ...(input !== undefined ? { body: options.raw ? input : JSON.stringify(input) } : {}) }), { address: 'test' });
  }
  async function login() {
    const response = await request('/api/auth/login', 'POST', { username: 'test-admin', password });
    assert.equal(response.status, 200); sessionCookie = response.headers.get('set-cookie').split(';')[0];
    assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  }
  return { store, request, login, directory };
}

test('迁移保留现有内容，所有公开页面和历史别名可解析', () => {
  assert.deepEqual(Object.fromEntries(collections.map(c => [c, Object.keys(seed.collections[c]).length])), { news: 359, members: 104, publications: 7, resources: 6, pages: 77 });
  for (const c of collections) for (const r of Object.values(seed.collections[c])) assert.doesNotThrow(() => validateRecord(c, r, r), `${c}/${r.id}`);
  for (const slug of [...Object.keys(templates.lists), ...Object.values(seed.collections.pages).map(p => p.slug), ...Object.values(seed.collections.news).map(p => p.url)]) {
    const page = renderPage(new URL(origin + '/' + slug), seed);
    assert.equal(page.status, 200, slug); assert.ok(page.html.includes('<main id="main">'), slug);
    assert.deepEqual(renderPage(new URL(origin + '/' + slug.replace(/\.html$/, '')), seed), page, slug + ' without extension');
  }
  for (const [slug, target] of Object.entries(templates.aliases)) {
    assert.equal(renderPage(new URL(origin + '/' + slug), seed).location, '/' + target);
    assert.equal(renderPage(new URL(origin + '/' + slug.replace(/\.html$/, '')), seed).location, '/' + target);
  }
  const home = load(renderPage(new URL(origin), seed).html);
  assert.equal(home('[data-imed-slot]').length, 0); assert.equal(home('.pub-card').length, 3);
  assert.equal(home('.news-row').length, 30); assert.equal(home('script:not([src])').length, 0);
});

test('本地登录、权限、跨站请求与登录限流', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/admin/news')).status, 401);
  assert.equal((await f.request('/api/auth/login', 'POST', { username: 'test-admin', password }, { headers: { Origin: 'http://evil.example' } })).status, 403);
  await f.login();
  assert.equal((await f.request('/api/auth/me')).status, 200);
  assert.equal((await f.request('/api/admin/news', 'POST', newsInput, { headers: { Origin: 'http://evil.example' } })).status, 403);
  assert.equal((await f.request('/api/admin/news', 'POST', newsInput, { headers: { Origin: '' } })).status, 403);
  const localAuth = createLocalAuth(env);
  for (let i = 0; i < 5; i++) await assert.rejects(localAuth.login({ username: 'test-admin', password: 'bad' }, 'bad-ip'), e => e.status === 401);
  await assert.rejects(localAuth.login({ username: 'test-admin', password }, 'bad-ip'), e => e.status === 429);
  const logout = await f.request('/api/auth/logout', 'POST'); assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});

test('Identity 必须由登录服务验证，并检查可信角色／邮箱白名单', async () => {
  let calls = 0;
  const identity = { id: 'trusted-user', email: 'owner@example.test', app_metadata: { roles: ['admin'] } };
  const auth = createIdentityAuth({ URL: 'https://imed.example.test' }, async (url, options) => {
    calls++; assert.equal(String(url), 'https://imed.example.test/.netlify/identity/user'); assert.equal(options.headers.Authorization, 'Bearer real-token');
    return Response.json(identity);
  });
  const request = new Request('https://preview.example.test/api/admin/news', { headers: { Authorization: 'Bearer real-token' } });
  assert.equal((await auth.user(request)).id, 'trusted-user'); await auth.user(request); assert.equal(calls, 1);
  const forbidden = createIdentityAuth({ URL: 'https://imed.example.test' }, async () => Response.json({ ...identity, app_metadata: { roles: [] }, user_metadata: { roles: ['admin'] } }));
  await assert.rejects(forbidden.user(request), e => e.status === 403);
  const allowed = createIdentityAuth({ URL: 'https://imed.example.test', IMED_ADMIN_EMAILS: 'OWNER@example.test' }, async () => Response.json({ ...identity, app_metadata: {} }));
  assert.equal((await allowed.user(request)).id, 'trusted-user');
  const revoked = createIdentityAuth({ URL: 'https://imed.example.test' }, async () => new Response(null, { status: 401 }));
  await assert.rejects(revoked.user(request), e => e.status === 401);
});

test('新闻草稿、发布、年份筛选、搜索、冲突检测、撤下及删除形成闭环', async t => {
  const f = await fixture(t); await f.login();
  const create = await f.request('/api/admin/news', 'POST', newsInput); assert.equal(create.status, 201);
  let item = (await create.json()).item;
  assert.equal((await f.request('/' + item.url)).status, 404);
  assert.equal((await f.request('/' + item.url.replace('article.html', 'article'))).status, 404);
  assert.equal((await f.request('/api/content/news/' + item.id)).status, 404);
  assert.equal((await (await f.request('/api/search?q=' + encodeURIComponent(item.title))).json()).total, 0);
  assert.equal((await f.request('/api/admin/news/' + item.id, 'PUT', { ...item, status: 'published' })).status, 428);
  const publish = await f.request('/api/admin/news/' + item.id, 'PUT', { ...item, status: 'published' }, { headers: { 'If-Match': '"1"' } }); assert.equal(publish.status, 200);
  item = (await publish.json()).item;
  const page = await f.request('/' + item.url); assert.equal(page.status, 200); assert.ok((await page.text()).includes('新正文'));
  const shortPage = await f.request('/' + item.url.replace('article.html', 'article')); assert.equal(shortPage.status, 200); assert.ok((await shortPage.text()).includes('新正文'));
  const slashPage = await f.request('/' + item.url.replace('article.html', 'article/')); assert.equal(slashPage.status, 302); assert.equal(slashPage.headers.get('location'), '/' + item.url.replace('article.html', 'article'));
  const slashHtmlPage = await f.request('/' + item.url.replace('article.html', 'article.html/')); assert.equal(slashHtmlPage.status, 302); assert.equal(slashHtmlPage.headers.get('location'), '/' + item.url);
  const list = await (await f.request('/news.html')).text(); assert.ok(list.includes('独立测试新闻 $&amp;')); assert.ok(list.includes('<option>2027</option>'));
  const home = await (await f.request('/')).text(); assert.ok(home.includes('独立测试新闻 $&amp;'));
  const search = await (await f.request('/api/search?q=' + encodeURIComponent('独立测试新闻'))).json(); assert.equal(search.total, 1);
  assert.equal((await f.request('/api/admin/news/' + item.id, 'PUT', item, { headers: { 'If-Match': '"1"' } })).status, 409);
  const unpublish = await f.request('/api/admin/news/' + item.id, 'PUT', { ...item, status: 'draft' }, { headers: { 'If-Match': '"2"' } }); assert.equal(unpublish.status, 200);
  assert.equal((await f.request('/' + item.url)).status, 404);
  assert.equal((await f.request('/' + item.url.replace('article.html', 'article'))).status, 404);
  assert.equal((await f.request('/api/admin/news/' + item.id, 'DELETE', undefined, { headers: { 'If-Match': '"3"' } })).status, 200);
  assert.equal((await f.request('/api/admin/news/' + item.id)).status, 404);
  // A legacy URL must also stop serving its archived body, including after reopening the database.
  const legacy = seed.collections.news['view-34079'];
  assert.equal((await f.request('/api/admin/news/' + legacy.id, 'DELETE', undefined, { headers: { 'If-Match': '"1"' } })).status, 200);
  const removed = await f.request('/view-34079.html'); assert.equal(removed.status, 404); assert.ok(!(await removed.text()).includes(legacy.title));
  const shortRemoved = await f.request('/view-34079'); assert.equal(shortRemoved.status, 404); assert.ok(!(await shortRemoved.text()).includes(legacy.title));
  const second = await createLocalStorage(join(f.directory, 'db.sqlite')); assert.equal((await second.read()).state.collections.news[legacy.id], undefined); second.close();
  assert.equal((await (await f.request('/api/admin/export')).json()).history.length, 5);
});

test('成员、论文、资源和自定义页面都能保存并出现在对应前台页面', async t => {
  const f = await fixture(t); await f.login();
  for (const [collection, input, page, selector] of [
    ['members', { title: '新成员', englishName: 'New Member', role: '博士后', category: '研究人员', image: '', link: '', order: -10 }, '/team.html', '.person-card'],
    ['publications', { title: '新成果', journal: 'Medical Image Analysis', year: '2027', description: '发表说明', link: 'https://example.test/paper', order: -10 }, '/publications.html', '.publication-item'],
    ['resources', { title: '新资源', subtitle: '测试用途', description: '说明', availability: '下载待开放', link: '', order: -10 }, '/datasets.html', '.dataset-card'],
    ['pages', { title: '新页面', slug: 'new-page.html', description: '介绍', bodyHtml: '<h2>新页面正文</h2>' }, '/new-page.html', 'main h2'],
  ]) {
    const result = await f.request('/api/admin/' + collection, 'POST', { ...input, status: 'published' }); assert.equal(result.status, 201, collection);
    const html = await (await f.request(page)).text(), $ = load(html); assert.ok($(selector).first().text().includes(input.title), collection);
  }
  const reserved = await f.request('/api/admin/pages', 'POST', { title: '占用地址', slug: 'news.html', bodyHtml: '<p>内容</p>' }); assert.equal(reserved.status, 400);
  const home = seed.collections.pages.index;
  assert.equal((await f.request('/api/admin/pages/index', 'DELETE', undefined, { headers: { 'If-Match': '"1"' } })).status, 400);
  assert.equal((await f.request('/api/admin/pages/index', 'PUT', { ...home, status: 'draft' }, { headers: { 'If-Match': '"1"' } })).status, 400);
});

test('使用独立版本请求头保存及删除，缺失或旧版本仍拒绝覆盖', async t => {
  const f = await fixture(t); await f.login();
  const result = await f.request('/api/admin/members', 'POST', { title: '线上保存回归成员', category: '在读学生', status: 'draft' });
  assert.equal(result.status, 201);
  const item = (await result.json()).item, path = '/api/admin/members/' + item.id;
  assert.equal((await f.request(path, 'PUT', { ...item, status: 'published' })).status, 428);
  const save = await f.request(path, 'PUT', { ...item, status: 'published' }, { headers: { 'X-IMED-Revision': '1' } });
  assert.equal(save.status, 200); assert.equal((await save.json()).item.revision, 2);
  assert.ok((await (await f.request('/team')).text()).includes(item.title));
  for (const revision of ['1', '*', 'undefined', '2,1']) {
    assert.equal((await f.request(path, 'PUT', item, { headers: { 'X-IMED-Revision': revision } })).status, 409);
    assert.equal((await f.request(path, 'DELETE', undefined, { headers: { 'X-IMED-Revision': revision } })).status, 409);
  }
  assert.equal((await f.request(path, 'DELETE')).status, 428);
  assert.equal((await f.request(path, 'DELETE', undefined, { headers: { 'X-IMED-Revision': '2' } })).status, 200);
  assert.ok(!(await (await f.request('/team')).text()).includes(item.title));
});

test('HTML、危险链接、日期和提交大小在服务端校验', async t => {
  const f = await fixture(t); await f.login();
  const dangerous = '<p onclick="alert(1)">保留文字</p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">链接</a><iframe src="https://evil.example"></iframe><svg><script>alert(1)</script></svg>';
  const result = await f.request('/api/admin/news', 'POST', { ...newsInput, status: 'published', bodyHtml: dangerous });
  assert.equal(result.status, 201); const html = (await result.json()).item.bodyHtml; assert.ok(html.includes('保留文字')); assert.doesNotMatch(html, /onerror|onclick|javascript:|<script|<iframe/);
  assert.equal((await f.request('/api/admin/news', 'POST', { ...newsInput, sourceUrl: 'javascript:alert(1)' })).status, 400);
  assert.equal((await f.request('/api/admin/news', 'POST', { ...newsInput, date: '2027-02-30' })).status, 400);
  assert.equal((await f.request('/api/admin/news', 'POST', '{invalid', { raw: true })).status, 400);
  assert.equal((await f.request('/api/admin/news', 'POST', { ...newsInput, bodyHtml: 'x'.repeat(500001) })).status, 413);
  assert.equal((await f.request('/api/admin/news', 'POST', newsInput, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.request('/api/admin/news', 'POST', { ...newsInput, status: 'unknown' })).status, 400);
});

test('图片签名校验、上传、读取与重启后的持久化', async t => {
  const f = await fixture(t); await f.login();
  // Real transparent one-pixel PNG.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  const login = await f.request('/api/auth/login', 'POST', { username: 'test-admin', password }); const token = login.headers.get('set-cookie').split(';')[0];
  const upload = bytes => createApp({ store: f.store, auth: createLocalAuth(env) })(new Request(origin + '/api/admin/media', { method: 'POST', headers: { Cookie: token, Origin: origin, 'Content-Type': 'image/png', 'X-File-Name': encodeURIComponent('图片.png') }, body: bytes }));
  assert.equal((await upload(Buffer.from('<svg onload="alert(1)"></svg>'))).status, 415);
  const response = await upload(png); assert.equal(response.status, 201); const item = (await response.json()).item;
  const media = await f.request(item.url); assert.equal(media.headers.get('content-type'), 'image/png'); assert.deepEqual(Buffer.from(await media.arrayBuffer()), png);
  const reopened = await createLocalStorage(join(f.directory, 'db.sqlite')); const stored = await reopened.getMedia(item.id); assert.deepEqual(Buffer.from(stored.data), png); reopened.close();
});

test('SQLite 条件更新避免并发覆盖', async t => {
  const f = await fixture(t);
  const a = await f.store.read(), b = await f.store.read();
  a.state.version++; await f.store.write(a.state, a.etag);
  await assert.rejects(f.store.write(b.state, b.etag), e => e.status === 409);
});

test('Netlify Blobs 使用创建／更新条件，不覆盖另一位管理员的修改', async () => {
  let saved = null, etag = null, calls = [];
  const mock = {
    async getWithMetadata() { return saved ? { data: structuredClone(saved), etag } : null; },
    async setJSON(key, state, conditions) {
      calls.push(conditions);
      if (conditions.onlyIfNew && saved || conditions.onlyIfMatch && conditions.onlyIfMatch !== etag) return { modified: false };
      saved = structuredClone(state); etag = String(Number(etag || 0) + 1); return { modified: true, etag };
    },
  };
  const store = new BlobStorage({ content: mock, media: {} }); const a = await store.read(), b = await store.read();
  await store.write(a.state, a.etag); await assert.rejects(store.write(b.state, b.etag), e => e.status === 409);
  const c = await store.read(); await store.write(c.state, c.etag);
  assert.deepEqual(calls, [{ onlyIfNew: true }, { onlyIfNew: true }, { onlyIfMatch: '1' }]);
});
