// One-time conversion of the existing static archive. Never run on deployment.
import { load } from 'cheerio';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { cleanHtml, plainText, collections } from '../server/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = async name => load(await readFile(resolve(root, name), 'utf8'));
const state = { schemaVersion: 1, version: 1, collections: Object.fromEntries(collections.map(c => [c, {}])), media: {}, history: [] };
const defaults = { status: 'published', revision: 1, createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z' };
const add = (collection, record) => { state.collections[collection][record.id] = { ...defaults, ...record }; };
const $news = await read('news.html');
for (const el of $news('.list-rows .news-row').toArray()) {
  const row = $news(el), url = row.attr('href'), id = url.replace(/\.html$/, '');
  const $ = await read(url);
  const date = $('.article-meta time').text().trim() || `${row.find('.news-date small').text().replace('.', '-')}-${row.find('.news-date strong').text()}`;
  const warning = $('main .notice').first().prop('outerHTML') || '';
  const bodyHtml = cleanHtml(warning + ($('.article-body').html() || '<p>原站归档未提供正文。</p>'));
  add('news', { id, url, title: row.find('h3').text().trim(), date, category: row.attr('data-category'), summary: plainText(bodyHtml).slice(0, 240), bodyHtml, sourceUrl: $('.article-source a').attr('href') || '' });
}
const $members = await read('team.html');
$members('.person-card').each((i, el) => {
  const card = $members(el);
  add('members', { id: `member-${i + 1}`, title: card.find('h3').text().trim(), englishName: card.find('.person-info small').text().trim(), role: card.find('.person-info p').text().trim(), category: card.attr('data-category'), image: card.find('img').attr('src') || '', link: card.find('.person-info a').attr('href') || '', order: i });
});
const $pubs = await read('publications.html');
$pubs('.publication-item').each((i, el) => {
  const card = $pubs(el), journal = card.find('.publication-journal').clone(); journal.find('small').remove();
  add('publications', { id: `publication-${i + 1}`, title: card.find('h2').text().trim(), journal: journal.text().trim(), year: card.attr('data-year'), description: card.find('p').text().trim(), link: card.find('a').attr('href') || '', order: i });
});
const $resources = await read('datasets.html');
$resources('.dataset-card').each((i, el) => {
  const card = $resources(el);
  add('resources', { id: `resource-${card.attr('id')}`, anchor: card.attr('id'), title: card.find('h2').text().trim(), subtitle: card.find('h3').text().trim(), description: card.find('p').text().trim(), availability: card.find('.pill').text().trim(), link: card.find('a').attr('href') || '', order: i });
});
const dynamicLists = ['news.html', 'events.html', 'culture.html', 'team.html', 'publications.html', 'datasets.html'];
const newsUrls = new Set(Object.values(state.collections.news).map(r => r.url));
const aliases = {};
for (const file of (await readdir(root)).filter(f => f.endsWith('.html'))) {
  const $ = await read(file);
  if (!$('main').length) {
    const refresh = $('meta[http-equiv="refresh"]').attr('content');
    if (refresh) { const match = refresh.match(/url=([^\s]+)/i); if (match) aliases[file] = match[1]; }
    continue;
  }
  if (dynamicLists.includes(file) || newsUrls.has(file) || ['article.html', '404.html'].includes(file)) continue;
  const main = $('main').clone(), banner = main.children('.page-banner');
  const bannerHtml = cleanHtml(banner.prop('outerHTML') || ''); banner.remove();
  if (file === 'index.html') {
    main.find('.news-layout > div').last().html('<div data-imed-slot="news"></div>');
    main.find('.feature-news').replaceWith('<div data-imed-slot="feature"></div>');
    main.find('.pub-grid').html('<div data-imed-slot="publications"></div>');
    main.find('.resources-strip .resource-compact').html('<div data-imed-slot="resources"></div>');
  }
  add('pages', { id: file.replace(/\.html$/, ''), slug: file, title: $('title').text().split('｜')[0].trim(), description: $('meta[name="description"]').attr('content') || '', bannerHtml, bodyHtml: cleanHtml(main.html() || '') });
}
// The common chrome and collection controls stay in server-side templates.
const source = await readFile(resolve(root, 'index.html'), 'utf8');
const frame = source.replace(/<main\b[^>]*>[\s\S]*?<\/main>/, '<main id="main">{{MAIN}}</main>').replace(/<script src="assets\/search-index\.js" defer><\/script>/, '');
const templates = { frame, lists: {}, aliases };
for (const file of dynamicLists) {
  const $ = await read(file), main = $('main').clone();
  main.find('.list-rows,.people-grid,.publication-list,.dataset-grid').empty();
  templates.lists[file] = main.html();
}
await mkdir(resolve(root, 'content'), { recursive: true });
await writeFile(resolve(root, 'content/seed.json'), JSON.stringify(state, null, 2) + '\n');
await writeFile(resolve(root, 'content/templates.json'), JSON.stringify(templates, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(collections.map(c => [c, Object.keys(state.collections[c]).length]))));
