import templates from '../content/templates.json' with { type: 'json' };
import { escape as e, visible, plainText } from './content.mjs';
import { linkedMember, renderProfile } from './profile.mjs';

export const newsRow = (r, home = false) => `<a class="news-row" data-item${home ? ' data-home-news' : ''} data-category="${e(r.category)}" data-year="${e(r.date.slice(0, 4))}" href="${e(r.url)}"><span class="news-date"><strong>${e(r.date.slice(8))}</strong><small>${e(r.date.slice(0, 7).replace('-', '.'))}</small></span><span><span class="tag">${e(r.category)}</span><h3>${e(r.title)}</h3></span><span class="arrow">→</span></a>`;
const memberCard = r => `<article class="person-card" data-item data-category="${e(r.category)}"><div class="person-photo">${r.image ? `<img src="${e(r.image)}" alt="${e(r.title)}" loading="lazy">` : `<div class="person-placeholder">${e(r.title.slice(0, 1))}</div>`}</div><div class="person-info"><small>${e(r.englishName)}</small><h3>${e(r.title)}</h3><p>${e(r.role)}</p>${r.link ? `<a href="${e(r.link)}">个人介绍 →</a>` : ''}</div></article>`;
const publicationCard = r => `<article class="publication-item" data-item data-year="${e(r.year)}"><div class="publication-journal">${e(r.journal)}<small>${e(r.year)}</small></div><div><h2>${e(r.title)}</h2><p>${e(r.description)}</p></div>${r.link ? `<a class="text-link" href="${e(r.link)}">查看详情 →</a>` : ''}</article>`;
const resourceCard = r => `<article class="dataset-card" id="${e(r.anchor)}"><div class="dataset-top"><h2>${e(r.title)}</h2><span class="pill">${e(r.availability)}</span></div><h3>${e(r.subtitle)}</h3><p>${e(r.description)}</p>${r.link ? `<a class="text-link" href="${e(r.link)}">数据说明与使用方式 →</a>` : ''}</article>`;
const banner = (title, desc = '') => `<section class="page-banner"><div class="container"><div class="breadcrumb"><a href="index.html">首页</a><span>/</span><span>${e(title)}</span></div><h1>${e(title)}</h1>${desc ? `<p>${e(desc)}</p>` : ''}</div></section>`;
function frame(main, title, description = '', language = 'zh-CN', active = '') {
  const html = templates.frame.replace('{{MAIN}}', () => main).replace(/<title>[\s\S]*?<\/title>/, () => `<title>${e(title)}｜iMED中国</title>`).replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${e(description || title)}">`).replace('<html lang="zh-CN">', `<html lang="${language}">`);
  return html.replace(/<nav\b[^>]*\bid="main-nav"[^>]*>[\s\S]*?<\/nav>/, navigation => navigation.replace(/<a\b[^>]*>/g, tag => {
    const selected = tag.match(/\bhref="([^"]+)"/)?.[1] === active;
    const updated = tag.replace(/\bclass="([^"]*)"/, (_, classes) => `class="${[...classes.split(/\s+/).filter(c => c && c !== 'active'), ...(selected ? ['active'] : [])].join(' ')}"`).replace(/\saria-current="[^"]*"/, '');
    return selected ? updated.replace(/>$/, ' aria-current="page">') : updated;
  }));
}
const updateYears = (html, years) => html.replace(/<select\b[^>]*data-year[^>]*>[\s\S]*?<\/select>/, () => `<select data-year aria-label="选择年份"><option value="">全部年份</option>${[...new Set(years)].sort().reverse().map(y => `<option>${e(y)}</option>`).join('')}</select>`);
function homeBody(html, state) {
  const news = visible(state, 'news'), pubs = visible(state, 'publications'), resources = visible(state, 'resources');
  const feature = news.find(n => n.category === '团队活动') || news[0];
  const image = feature?.bodyHtml.match(/<img\b[^>]*src="([^"]+)"/)?.[1];
  const slots = {
    news: `<div class="news-tabs"><button data-home-category="全部" aria-pressed="true">全部</button><button data-home-category="论文发表" aria-pressed="false">论文发表</button><button data-home-category="学术活动" aria-pressed="false">学术活动</button></div>${news.slice(0, 30).map(n => newsRow(n, true)).join('') || '<p>暂无已发布动态。</p>'}`,
    feature: feature ? `<a class="feature-news" href="${e(feature.url)}">${image ? `<div class="feature-photo"><img src="${e(image)}" alt="${e(feature.title)}" loading="lazy"><span class="image-label">${e(feature.category)}</span></div>` : ''}<div class="meta"><span>${e(feature.date)}</span><span>${e(feature.category)}</span></div><h3>${e(feature.title)}</h3><p>${e(feature.summary)}</p></a>` : '<p>暂无已发布动态。</p>',
    publications: pubs.slice(0, 3).map(r => `<a class="pub-card" href="${e(r.link || 'publications.html')}"><span class="journal">${e(r.journal)}</span><h3>${e(r.title)}</h3><div class="meta"><span>${e(r.year)}</span></div></a>`).join(''),
    resources: resources.slice(0, 4).map(r => `<a class="resource-tile" href="${e(r.link || 'datasets.html#' + r.anchor)}"><span><strong>${e(r.title)}</strong><small>${e(r.subtitle)}</small></span><span class="arrow">→</span></a>`).join(''),
  };
  return html.replace(/<div data-imed-slot="(news|feature|publications|resources)"><\/div>/g, (_, slot) => slots[slot]);
}
export function renderPage(url, state) {
  let slug;
  try { slug = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html'; } catch { return missing(); }
  // Netlify and older shared links can omit .html; keep assets relative to the site root.
  if (/^[a-zA-Z0-9_-]+(?:\.html)?\/$/.test(slug)) return { status: 302, location: '/' + slug.slice(0, -1) + url.search };
  if (/^[a-zA-Z0-9_-]+$/.test(slug)) slug += '.html';
  if (templates.aliases[slug]) return { status: 302, location: '/' + templates.aliases[slug] };
  const id = url.searchParams.get('id');
  const article = slug === 'article.html' && id ? state.collections.news[id] : Object.values(state.collections.news).find(n => n.url === slug);
  if (article) {
    if (article.status !== 'published') return missing();
    const main = banner('内容详情', '科研进展、学术交流与开放资源') + `<section class="content-section"><div class="container article-layout"><article><div class="eyebrow">${e(article.category)}</div><h1 class="article-title">${e(article.title)}</h1><div class="article-meta meta"><time>${e(article.date)}</time><span>iMED 中国</span></div><div class="article-body">${article.bodyHtml}</div>${article.sourceUrl ? `<div class="article-source">来源：<a href="${e(article.sourceUrl)}" target="_blank" rel="noopener noreferrer">原始资料 ↗</a></div>` : ''}</article><aside class="article-aside"><h3>继续探索</h3><a href="news.html">新闻动态 →</a><a href="publications.html">科研成果 →</a><a href="team.html">团队成员 →</a></aside></div></section>`;
    return { status: 200, html: frame(main, article.title, article.summary, 'zh-CN', 'news.html') };
  }
  if (slug === 'article.html' && !id) return { status: 302, location: '/news.html' };
  if (templates.lists[slug]) {
    let main = templates.lists[slug], rows, title;
    if (['news.html', 'events.html', 'culture.html'].includes(slug)) {
      rows = visible(state, 'news').filter(r => slug === 'news.html' || r.category === (slug === 'events.html' ? '学术活动' : '团队活动'));
      main = main.replace('<div class="list-rows"></div>', () => `<div class="list-rows">${rows.map(r => newsRow(r)).join('')}</div>`);
      main = updateYears(main, rows.map(r => r.date.slice(0, 4)));
      title = slug === 'news.html' ? '新闻动态' : slug === 'events.html' ? 'iMED 分享会' : '团队风采';
    } else {
      const config = { 'team.html': ['members', 'people-grid', memberCard, '团队成员'], 'publications.html': ['publications', 'publication-list', publicationCard, '科研成果'], 'datasets.html': ['resources', 'dataset-grid', resourceCard, '数据与代码'] }[slug];
      rows = visible(state, config[0]); title = config[3];
      main = main.replace(`<div class="${config[1]}"></div>`, () => `<div class="${config[1]}">${rows.map(config[2]).join('')}</div>`);
      if (slug === 'publications.html') main = updateYears(main, rows.map(r => r.year));
    }
    return { status: 200, html: frame(main, title, '', 'zh-CN', ['events.html', 'culture.html'].includes(slug) ? 'news.html' : slug) };
  }
  const page = Object.values(state.collections.pages).find(p => p.slug === slug);
  if (page?.status === 'published') {
    const member = linkedMember(url, slug, state);
    if (member) return { status: 200, html: frame(renderProfile(page, member), member.title + ' · 团队成员', page.description, 'zh-CN', 'team.html') };
    const body = slug === 'index.html' ? homeBody(page.bodyHtml, state) : page.bodyHtml;
    const english = page.bannerHtml?.match(/<span class="english">[\s\S]*?<\/span>/)?.[0] || '';
    const pageBanner = page.bannerHtml?.replace(/<h1>[\s\S]*?<\/h1>/, () => `<h1>${e(page.title)} ${english}</h1>`);
    const main = (pageBanner || (slug === 'index.html' ? '' : banner(page.title))) + body;
    return { status: 200, html: frame(main, page.title, page.description, slug === 'english.html' ? 'en' : 'zh-CN', slug) };
  }
  return missing();
}
function missing() {
  return { status: 404, html: frame(banner('内容暂不可用', '页面不存在、已撤下或尚未发布。') + '<section class="content-section"><div class="container"><a class="button" href="news.html">浏览新闻动态 →</a></div></section>', '内容暂不可用') };
}
export function searchRecords(state, query) {
  const records = [
    ...visible(state, 'news').map(r => ({ title: r.title, category: r.category, date: r.date, url: r.url, text: r.summary + ' ' + plainText(r.bodyHtml) })),
    ...visible(state, 'members').map(r => ({ title: r.title, category: '团队成员', url: 'team.html', text: [r.englishName, r.role, r.category].join(' ') })),
    ...visible(state, 'publications').map(r => ({ title: r.title, category: '科研成果', url: r.link || 'publications.html', text: r.journal + ' ' + r.year + ' ' + r.description })),
    ...visible(state, 'resources').map(r => ({ title: r.title, category: '数据资源', url: 'datasets.html#' + r.anchor, text: r.subtitle + ' ' + r.description })),
    ...visible(state, 'pages').map(r => ({ title: r.title, category: '栏目 / 资源', url: r.slug, text: plainText(r.bodyHtml) })),
  ];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const found = records.filter(r => terms.every(term => `${r.title} ${r.text}`.toLowerCase().includes(term))).sort((a, b) => Number(b.title.toLowerCase().includes(query.toLowerCase())) - Number(a.title.toLowerCase().includes(query.toLowerCase())));
  return { total: found.length, items: found.slice(0, 40).map(({ text, ...rest }) => rest) };
}
