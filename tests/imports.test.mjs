import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from 'cheerio';
import seed from '../content/seed.json' with { type: 'json' };
import additions from '../content/import-2026-10.json' with { type: 'json' };
import { applyContentImports } from '../server/imports.mjs';
import { BlobStorage, createLocalStorage } from '../server/storage.mjs';
import { validateRecord } from '../server/content.mjs';
import { renderPage, searchRecords } from '../server/render.mjs';

test('补充导入保留旧内容、识别已有文章，编辑和删除后不再重复添加', () => {
  const old = structuredClone(seed);
  old.collections.news['view-34075'].title = '管理员已修改的标题';
  delete old.collections.news['view-34073'];
  const article = additions.news.find(r => r.id === 'view-34080');
  old.collections.news['admin-created'] = { ...article, id: 'admin-created', bodyHtml: '<p>管理员已保存的新闻稿</p>' };
  const original = structuredClone(old);
  const { state, changed } = applyContentImports(old);
  assert.equal(changed, true); assert.deepEqual(old, original);
  assert.equal(state.collections.news['view-34075'].title, '管理员已修改的标题');
  assert.equal(state.collections.news['view-34073'], undefined);
  assert.equal(state.collections.news['view-34080'], undefined);
  assert.equal(state.collections.news['admin-created'].bodyHtml, '<p>管理员已保存的新闻稿</p>');
  delete state.collections.news['lecture-poster-01'];
  state.collections.news['lecture-poster-02'].title = '修改海报标题';
  state.collections.news['lecture-poster-03'].status = 'draft';
  const again = applyContentImports(state);
  assert.equal(again.changed, false); assert.strictEqual(again.state, state);
  assert.equal(again.state.collections.news['lecture-poster-01'], undefined);
  assert.equal(again.state.collections.news['lecture-poster-02'].title, '修改海报标题');
  assert.equal(again.state.collections.news['lecture-poster-03'].status, 'draft');
});

test('已有 Blobs 内容导入遇到并发保存时重读，保留最新编辑和版本', async () => {
  let value = structuredClone(seed), version = 10, collide = true, writes = 0;
  const content = {
    async getWithMetadata() { return { data: structuredClone(value), etag: String(version) }; },
    async setJSON(key, next, options) {
      writes++; assert.equal(options.onlyIfMatch, String(version));
      if (collide) { collide = false; value.collections.news['view-34075'].title = '并发管理员保存'; version++; return { modified: false }; }
      value = structuredClone(next); version++; return { modified: true, etag: String(version) };
    },
  };
  const store = new BlobStorage({ content, media: {} });
  const imported = await store.read();
  assert.equal(writes, 2); assert.equal(imported.etag, '12');
  assert.equal(imported.state.collections.news['view-34075'].title, '并发管理员保存');
  assert.equal(Object.keys(imported.state.collections.news).length, 422);
  delete imported.state.collections.news['lecture-poster-63'];
  await store.write(imported.state, imported.etag);
  const after = await store.read();
  assert.equal(after.state.collections.news['lecture-poster-63'], undefined); assert.equal(writes, 3);
});

test('SQLite 旧数据库自动补充一次，重启后尊重撤下和删除', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'imed-import-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'db.sqlite'); let store = await createLocalStorage(file);
  let current = await store.read();
  const old = structuredClone(seed); old.collections.news['view-34075'].summary = '保留线上摘要';
  await store.write(old, current.etag); current = await store.read();
  assert.equal(current.state.collections.news['view-34075'].summary, '保留线上摘要');
  assert.equal(Object.keys(current.state.collections.news).length, 422);
  delete current.state.collections.news['lecture-poster-01'];
  current.state.collections.news['lecture-poster-02'].status = 'draft';
  await store.write(current.state, current.etag); store.close();
  store = await createLocalStorage(file);
  try {
    const reopened = await store.read();
    assert.equal(reopened.state.collections.news['lecture-poster-01'], undefined);
    assert.equal(reopened.state.collections.news['lecture-poster-02'].status, 'draft');
  } finally { store.close(); }
});

test('62 张海报和新闻稿可编辑、检索、阅读，静态图片都存在', async () => {
  const state = applyContentImports(seed).state;
  assert.equal(additions.news.filter(r => r.category === '讲座海报').length, 62);
  for (const item of additions.news) {
    assert.doesNotThrow(() => validateRecord('news', item, item), item.id);
    const html = load(renderPage(new URL('https://example.test/' + item.url), state).html);
    assert.equal(html('.article-title').text(), item.title);
    if (item.posterImage) {
      assert.equal(html('.lecture-poster img').attr('src'), item.posterImage);
      for (const path of [item.posterImage, item.posterThumbnail]) assert.ok((await stat(new URL('../' + path, import.meta.url))).size > 0);
    }
  }
  const wall = load(renderPage(new URL('https://example.test/lectures.html'), state).html);
  assert.equal(wall('.poster-card').length, 62);
  assert.ok(searchRecords(state, 'Trusted AI').items.some(r => r.category === 'iMED 分享会'));
  const article = load(renderPage(new URL('https://example.test/view-34080'), state).html);
  assert.equal(article('.article-body figure').length, 5);
  assert.ok(article('.article-body').text().includes('编辑： 吴东涵、许卓婷、李宏硕'));
  assert.equal(load(renderPage(new URL('https://example.test/news.html'), state).html)('[data-category="讲座海报"]').length > 0, true);
  assert.equal(wall('main h1').text(), 'iMED 分享会');
  assert.equal(load(renderPage(new URL('https://example.test/news.html'), state).html)('button[data-category="讲座海报"]').text(), 'iMED 分享会');
  state.collections.news['lecture-poster-63'].status = 'draft';
  assert.equal(renderPage(new URL('https://example.test/article.html?id=lecture-poster-63'), state).status, 404);
  assert.equal(load(renderPage(new URL('https://example.test/lectures.html'), state).html)('.poster-card').length, 61);
  assert.throws(() => validateRecord('news', { ...additions.news[0], posterImage: 'javascript:alert(1)' }), e => e.status === 400);
  assert.throws(() => validateRecord('news', { ...additions.news[0], posterImage: '' }), e => e.status === 400);
});
