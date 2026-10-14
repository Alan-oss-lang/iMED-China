import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from 'cheerio';
import seed from '../content/seed.json' with { type: 'json' };
import additions from '../content/import-2026-10.json' with { type: 'json' };
import memberNames from '../content/member-name-corrections.json' with { type: 'json' };
import research from '../content/research-directions-upgrade.json' with { type: 'json' };
import { applyContentImports } from '../server/imports.mjs';
import { BlobStorage, createLocalStorage } from '../server/storage.mjs';
import { validateRecord, cleanHtml } from '../server/content.mjs';
import { renderPage, searchRecords } from '../server/render.mjs';

function oldMemberState() {
  const state = structuredClone(seed);
  state.appliedContentImports = [additions.id];
  for (const item of memberNames.members) state.collections.members[item.id].englishName = item.previousEnglishName;
  return state;
}

function oldResearchState() {
  const state = structuredClone(seed);
  state.appliedContentImports = [additions.id, memberNames.id];
  state.collections.pages.research.bodyHtml = research.previousBodyHtml;
  state.collections.pages.research.description = research.previousDescription;
  return state;
}

test('研究方向仅升级原正文，保留后台改动、发布状态、删除和后续编辑', () => {
  const original = oldResearchState(), page = original.collections.pages.research;
  page.title = '管理员标题'; page.description = '管理员摘要'; page.status = 'draft';
  page.bannerHtml = '<section>自定义横幅</section>'; page.revision = 7;
  page.bodyHtml = cleanHtml(page.bodyHtml);
  const before = structuredClone(original), upgraded = applyContentImports(original);
  assert.deepEqual(original, before);
  assert.equal(upgraded.state.collections.pages.research.bodyHtml, research.bodyHtml);
  assert.equal(upgraded.state.collections.pages.research.revision, 8);
  for (const field of ['title', 'description', 'status', 'bannerHtml', 'slug', 'createdAt']) assert.equal(upgraded.state.collections.pages.research[field], page[field]);
  assert.equal(upgraded.state.history.at(-1).id, research.id);
  upgraded.state.collections.pages.research.bodyHtml = '<p>升级后继续编辑</p>';
  assert.strictEqual(applyContentImports(upgraded.state).state, upgraded.state);
  for (const change of ['edit', 'delete', 'slug']) {
    const edited = oldResearchState();
    if (change === 'edit') edited.collections.pages.research.bodyHtml = '<p>管理员已编辑研究方向</p>';
    if (change === 'delete') delete edited.collections.pages.research;
    if (change === 'slug') edited.collections.pages.research.slug = 'custom.html';
    const record = structuredClone(edited.collections.pages.research);
    const next = applyContentImports(edited).state;
    assert.deepEqual(next.collections.pages.research, record);
    assert.ok(next.appliedContentImports.includes(research.id));
  }
});

test('SQLite 研究方向升级持久化，八张示意图与英文说明支持渲染、搜索和后台保存', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'imed-research-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'db.sqlite'); let store = await createLocalStorage(file);
  let current = await store.read(); await store.write(oldResearchState(), current.etag);
  current = await store.read();
  const page = current.state.collections.pages.research;
  assert.equal(page.bodyHtml, research.bodyHtml);
  assert.equal(page.description, research.description);
  const html = load(renderPage(new URL('https://example.test/research.html'), current.state).html);
  assert.equal(html('.research-topic').length, 5);
  const illustrations = html('img[src^="assets/media/research/"]');
  assert.equal(illustrations.length, 8);
  for (const image of illustrations.toArray()) {
    const src = html(image).attr('src');
    assert.equal(html(image).parent('a').attr('href'), src);
    assert.equal(html(image).parent('a').attr('target'), '_blank');
    assert.ok((await stat(new URL('../' + src, import.meta.url))).size > 0);
  }
  for (const term of ['Topology Estimation', 'Artery/Vein Classification', 'Vessel/Nerve Segmentation', 'Medical Image Enhancement', 'Angle-Closure Assessment', 'Ocular Diseases', 'Eye-Brain Joint Computing', 'AI-Assisted Materials Discovery']) {
    assert.ok(html('main').text().includes(term), term);
    assert.ok(searchRecords(current.state, term).items.some(item => item.url === 'research.html'), term);
  }
  const saved = validateRecord('pages', page, page);
  const editorHtml = load(saved.bodyHtml);
  assert.equal(editorHtml('.research-topic').length, 5);
  assert.equal(editorHtml('.research-methods dt').length, 3);
  assert.equal(editorHtml('img[src^="assets/media/research/"]').length, 8);
  current.state.collections.pages.research.bodyHtml = saved.bodyHtml + '<p>管理员新增说明</p>';
  await store.write(current.state, current.etag); store.close();
  store = await createLocalStorage(file);
  try { assert.ok((await store.read()).state.collections.pages.research.bodyHtml.endsWith('<p>管理员新增说明</p>')); }
  finally { store.close(); }
});

test('Blobs 研究方向升级与管理员同时保存时重读，保留最新正文且不重复升级', async () => {
  let value = oldResearchState(), version = 1, collide = true, writes = 0;
  const store = new BlobStorage({ media: {}, content: {
    async getWithMetadata() { return { data: structuredClone(value), etag: String(version) }; },
    async setJSON(key, next, options) {
      writes++; assert.equal(options.onlyIfMatch, String(version));
      if (collide) {
        collide = false;
        value.collections.pages.research.bodyHtml = '<p>管理员刚刚保存的研究方向</p>';
        value.collections.pages.research.revision++;
        version++; return { modified: false };
      }
      value = structuredClone(next); version++; return { modified: true, etag: String(version) };
    },
  } });
  const current = await store.read();
  assert.equal(current.state.collections.pages.research.bodyHtml, '<p>管理员刚刚保存的研究方向</p>');
  assert.equal(current.state.collections.pages.research.revision, 2);
  assert.ok(current.state.appliedContentImports.includes(research.id));
  assert.equal(writes, 2);
  assert.equal((await store.read()).etag, current.etag);
  assert.equal(writes, 2);
});

test('成员姓名修正仅更新对应旧错误字段，保留自定义姓名、新成员、草稿和删除', () => {
  const old = oldMemberState();
  old.collections.members['member-16'].englishName = 'Hong-Shuo Li';
  old.collections.members['member-17'].title = '改名的成员';
  delete old.collections.members['member-18'];
  old.collections.members['member-20'].status = 'draft';
  old.collections.members['member-24'].revision = 8;
  old.collections.members['member-24'].role = '后台已更新的介绍';
  old.collections.members['member-24'].image = '/api/media/new-avatar';
  old.collections.members['new-member'] = { ...seed.collections.members['member-16'], id: 'new-member', title: '王嘉浩', englishName: 'Jiahao Wang' };
  const before = structuredClone(old), { state, changed } = applyContentImports(old);
  assert.equal(changed, true); assert.deepEqual(old, before);
  assert.deepEqual(state.collections.members['member-16'], before.collections.members['member-16']);
  assert.deepEqual(state.collections.members['member-17'], before.collections.members['member-17']);
  assert.equal(state.collections.members['member-18'], undefined);
  assert.deepEqual(state.collections.members['new-member'], before.collections.members['new-member']);
  assert.equal(state.collections.members['member-20'].status, 'draft');
  assert.equal(state.collections.members['member-20'].englishName, 'Donghan Wu');
  const updated = state.collections.members['member-24'];
  assert.equal(updated.englishName, 'Zhuoting Xu'); assert.equal(updated.revision, 9);
  const { englishName, revision, updatedAt, ...unchanged } = updated;
  const { englishName: previousName, revision: previousRevision, updatedAt: previousTime, ...previous } = before.collections.members['member-24'];
  assert.deepEqual(unchanged, previous); assert.ok(updatedAt);
  assert.equal(state.history.at(-1).collection, 'members');
  updated.englishName = 'Personal Signature';
  delete state.collections.members['member-19'];
  assert.strictEqual(applyContentImports(state).state, state);
});

test('已有 Blobs 成员资料遇到并发编辑时保留新署名，成功后不重复修正', async () => {
  let value = oldMemberState(), version = 1, collide = true;
  const store = new BlobStorage({ media: {}, content: {
    async getWithMetadata() { return { data: structuredClone(value), etag: String(version) }; },
    async setJSON(key, next, options) {
      assert.equal(options.onlyIfMatch, String(version));
      if (collide) { collide = false; value.collections.members['member-16'].englishName = 'Hong-Shuo Li'; value.collections.members['member-16'].revision++; version++; return { modified: false }; }
      value = structuredClone(next); version++; return { modified: true, etag: String(version) };
    },
  } });
  const first = await store.read();
  assert.equal(first.state.collections.members['member-16'].englishName, 'Hong-Shuo Li');
  assert.equal(first.state.collections.members['member-20'].englishName, 'Donghan Wu');
  assert.equal(first.state.collections.members['member-20'].revision, 2);
  const next = await store.read(); assert.equal(next.etag, first.etag);
});

test('SQLite 已有姓名修正会持久化，前台卡片、成员详情和英文检索使用正确姓名', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'imed-names-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'db.sqlite'); let store = await createLocalStorage(file);
  const first = await store.read(); await store.write(oldMemberState(), first.etag);
  const corrected = await store.read();
  for (const correction of memberNames.members) assert.equal(corrected.state.collections.members[correction.id].englishName, correction.englishName);
  const team = load(renderPage(new URL('https://example.test/team.html'), corrected.state).html);
  for (const member of Object.values(corrected.state.collections.members)) {
    const card = team('.person-card').filter((_, node) => team(node).find('h3').text() === member.title).first();
    assert.equal(card.find('.person-info small').text(), member.englishName, member.title);
    assert.ok(!/iMED CHINA/i.test(member.englishName));
  }
  const profile = load(renderPage(new URL('https://example.test/view-15329.html'), corrected.state).html);
  assert.equal(profile('.profile-english-name').text(), 'Lei Mou');
  assert.ok(searchRecords(corrected.state, 'Hongshuo Li').items.some(item => item.title === '李宏硕'));
  corrected.state.collections.members['member-20'].englishName = 'Custom English Signature';
  await store.write(corrected.state, corrected.etag); store.close();
  store = await createLocalStorage(file);
  try { assert.equal((await store.read()).state.collections.members['member-20'].englishName, 'Custom English Signature'); }
  finally { store.close(); }
});

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
