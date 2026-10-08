import sanitizeHtml from 'sanitize-html';
import { randomUUID } from 'node:crypto';

export const collections = ['news', 'members', 'publications', 'resources', 'pages'];
export const newsCategories = ['论文发表', '学术活动', '团队活动'];
export const memberCategories = ['研究人员', '在读学生', '客聘专家', '毕业校友'];
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const plainText = html => sanitizeHtml(html || '', { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
export function cleanHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'section', 'article', 'aside', 'time', 'figure', 'figcaption', 'button', 'svg', 'path', 'circle', 'rect', 'ellipse'],
    allowedAttributes: {
      '*': ['class', 'id', 'lang', 'aria-label', 'data-imed-slot'],
      a: ['href', 'target', 'rel', 'class', 'id'],
      img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'class'],
      td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan', 'scope'], time: ['datetime'],
      button: ['type', 'data-home-category', 'aria-pressed'],
      svg: ['viewBox', 'viewbox', 'class', 'aria-hidden'], path: ['d'], circle: ['cx', 'cy', 'r'], rect: ['x', 'y', 'width', 'height', 'rx'], ellipse: ['cx', 'cy', 'rx', 'ry'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, ...(attribs.target === '_blank' ? { rel: 'noopener noreferrer' } : {}) } }),
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy', decoding: 'async' } }),
    },
  });
}
function string(input, key, max = 500, required = false) {
  const value = input[key] ?? '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new HttpError(400, `${key} 不能为空或超出长度限制（${max} 字符）`);
  return value.trim();
}
export function safeLink(value, { image = false } = {}) {
  if (!value) return '';
  // Relative site links are retained for the legacy archive; reject ambiguous schemes and backslashes.
  if (/[\x00-\x20\\]/.test(value) || value.startsWith('//') || /(?:^|\/)\.\.(?:\/|$)/.test(value)) throw new HttpError(400, '链接格式无效');
  if (value.startsWith('#') || value.startsWith('/') || /^[a-zA-Z0-9][a-zA-Z0-9_./?#=&%+-]*$/.test(value) && !value.includes(':')) return value;
  try { const url = new URL(value); if ((image ? ['https:'] : ['https:', 'http:', 'mailto:', 'tel:']).includes(url.protocol)) return value; } catch {}
  throw new HttpError(400, '链接只支持站内地址或安全的网络地址');
}
export function validateRecord(collection, input, previous) {
  if (!collections.includes(collection)) throw new HttpError(404, '栏目不存在');
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new HttpError(400, '内容格式无效');
  const record = {
    id: previous?.id || randomUUID(),
    title: string(input, 'title', 500, true),
    status: input.status ?? 'draft',
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revision: (previous?.revision || 0) + 1,
  };
  if (!['draft', 'published'].includes(record.status)) throw new HttpError(400, '发布状态无效');
  if (collection === 'news') {
    record.date = string(input, 'date', 10, true);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || !Number.isFinite(Date.parse(record.date)) || new Date(record.date).toISOString().slice(0, 10) !== record.date) throw new HttpError(400, '请选择有效的发布日期');
    record.category = string(input, 'category', 30, true);
    if (!newsCategories.includes(record.category)) throw new HttpError(400, '新闻分类无效');
    record.summary = string(input, 'summary', 2000);
    record.bodyHtml = cleanHtml(string(input, 'bodyHtml', 350000, true));
    if (!plainText(record.bodyHtml) && !record.bodyHtml.includes('<img')) throw new HttpError(400, '正文不能为空');
    record.sourceUrl = safeLink(string(input, 'sourceUrl', 2000));
    record.url = previous?.url || `article.html?id=${record.id}`;
  } else if (collection === 'members') {
    record.category = string(input, 'category', 30, true);
    if (!memberCategories.includes(record.category)) throw new HttpError(400, '成员分组无效');
    record.englishName = string(input, 'englishName', 200);
    record.role = string(input, 'role', 2000);
    record.image = safeLink(string(input, 'image', 2000), { image: true });
    record.link = safeLink(string(input, 'link', 2000));
  } else if (collection === 'publications') {
    record.year = string(input, 'year', 4, true);
    if (!/^(19|20|21)\d{2}$/.test(record.year)) throw new HttpError(400, '论文年份无效');
    record.journal = string(input, 'journal', 300, true);
    record.description = string(input, 'description', 2000);
    record.link = safeLink(string(input, 'link', 2000));
  } else if (collection === 'resources') {
    record.subtitle = string(input, 'subtitle', 500);
    record.description = string(input, 'description', 5000);
    record.availability = string(input, 'availability', 100, true);
    record.link = safeLink(string(input, 'link', 2000));
    record.anchor = previous?.anchor || `resource-${record.id}`;
  } else {
    record.slug = previous?.slug || string(input, 'slug', 100, true);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*\.html$/.test(record.slug)) throw new HttpError(400, '页面地址应为英文或数字组成的 .html 文件名');
    record.description = string(input, 'description', 2000);
    record.bodyHtml = cleanHtml(string(input, 'bodyHtml', 350000, true));
    record.bannerHtml = previous?.bannerHtml || '';
  }
  if (['members', 'publications', 'resources'].includes(collection)) {
    record.order = Number(input.order ?? previous?.order ?? 0);
    if (!Number.isSafeInteger(record.order) || Math.abs(record.order) > 1000000) throw new HttpError(400, '排序应为整数');
  }
  return record;
}
export function visible(state, collection) {
  return Object.values(state.collections[collection] || {}).filter(record => record.status === 'published').sort(collection === 'news' ? (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id) : (a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id));
}
export function publicSummary(record) {
  const { bodyHtml, bannerHtml, createdAt, updatedAt, revision, ...rest } = record;
  return rest;
}
