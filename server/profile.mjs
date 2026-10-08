import { load } from 'cheerio';
import { escape as e, visible } from './content.mjs';

export function linkedMember(url, slug, state) {
  return visible(state, 'members').find(member => {
    if (!member.link) return false;
    try {
      const target = new URL(member.link, url);
      let path = decodeURIComponent(target.pathname).replace(/^\//, '').replace(/\/$/, '');
      if (/^[a-zA-Z0-9_-]+$/.test(path)) path += '.html';
      return target.origin === url.origin && path === slug;
    } catch { return false; }
  });
}

function biography(page, member) {
  const $ = load(page.bodyHtml, null, false);
  const body = $('.article-body').first().length ? $('.article-body').first() : $.root();
  const source = $('.article-source').first().html() || '';
  const emails = [...new Set((body.text().match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []))];
  const links = [];
  body.find('a[href]').each((_, node) => {
    const href = $(node).attr('href');
    try {
      const target = new URL(href);
      if (!['https:', 'http:'].includes(target.protocol) || links.some(link => link.href === target.href)) return;
      const label = /(^|\.)scholar\.google\./.test(target.hostname) ? 'Google Scholar'
        : /(^|\.)github\.io$/.test(target.hostname) || target.hostname === 'sites.google.com' ? '个人主页'
        : target.hostname === 'zhuanlan.zhihu.com' ? '知乎专栏'
        : /\/publications\/?$/.test(target.pathname) ? '论文列表'
        : $(node).text().trim() || target.hostname;
      links.push({ href: target.href, label, host: target.hostname });
    } catch { /* Relative biography links remain in the original text. */ }
  });
  // The current member photo belongs in the profile header, rather than twice in the biography.
  body.find('img').each((_, node) => {
    if ($(node).attr('src')?.replace(/^\//, '') === member.image?.replace(/^\//, '')) $(node).remove();
  });
  body.find('p').each((_, node) => {
    const paragraph = $(node), text = paragraph.text().replace(/\s+/g, ' ').trim();
    if (!text && !paragraph.find('img,svg,table').length) paragraph.remove();
    // These two legacy paragraphs only repeat the personal-homepage link.
    if (/^(?:更多个人及团队信息，请访问[：:]\s*|For more detail,? please visit:\s*)https?:\/\/\S+$/i.test(text)) paragraph.remove();
  });
  const chinese = [], english = [];
  body.contents().each((_, node) => {
    const element = $(node), text = element.text().trim();
    if (!text && node.type === 'text') return;
    if (!text && !element.is('img,svg,table') && !element.find('img,svg,table').length) return;
    const html = $.html(node);
    const isEnglish = element.attr('lang')?.startsWith('en') || (!/[\u3400-\u9fff]/.test(text) && /[a-z]{3}/i.test(text) && !text.includes('@'));
    (isEnglish ? english : chinese).push(html);
  });
  return { chinese: chinese.join(''), english: english.join(''), emails, links, source };
}

export function renderProfile(page, member) {
  const bio = biography(page, member);
  const homepage = bio.links.find(link => link.label === '个人主页' && link.host.endsWith('.github.io')) || bio.links.find(link => link.label === '个人主页');
  const actions = [
    homepage ? `<a class="button light" href="${e(homepage.href)}" target="_blank" rel="noopener noreferrer">个人主页 <span class="arrow">↗</span></a>` : '',
    bio.emails[0] ? `<a class="profile-email-button" href="mailto:${e(bio.emails[0])}">邮件联系 <span class="arrow">↗</span></a>` : '',
  ].join('');
  const portrait = member.image
    ? `<img src="${e(member.image)}" alt="${e(member.title)}的照片" decoding="async">`
    : `<div class="profile-monogram" aria-hidden="true">${e(member.title.slice(0, 1))}</div>`;
  const hero = `<section class="profile-hero"><div class="container"><nav class="breadcrumb" aria-label="当前位置"><a href="index.html">首页</a><span>/</span><a href="team.html">团队成员</a><span>/</span><span>${e(member.title)}</span></nav><div class="profile-hero-grid"><div class="profile-identity"><div class="eyebrow">TEAM PROFILE · iMED CHINA</div><h1>${e(member.title)}</h1>${member.englishName ? `<p class="profile-english-name">${e(member.englishName)}</p>` : ''}<p class="profile-role">${e(member.role)}</p><div class="profile-affiliation"><span>${e(member.category)}</span><span>智能医学影像团队 · iMED 中国</span></div>${actions ? `<div class="profile-hero-actions">${actions}</div>` : ''}</div><figure class="profile-portrait">${portrait}<figcaption>iMED · ${e(member.category)}</figcaption></figure></div></div></section>`;
  const section = (id, number, label, title, html, language = 'zh-CN') => `<section class="profile-section" id="${id}" aria-labelledby="${id}-title"><div class="profile-section-heading"><span class="profile-section-number">${number}</span><div><div class="profile-overline">${label}</div><h2 id="${id}-title">${title}</h2></div></div><div class="profile-biography" lang="${language}">${html}</div></section>`;
  const sections = [
    bio.chinese ? section('profile-about', '01', 'BIOGRAPHY', bio.english ? '中文介绍' : '个人介绍', bio.chinese) : '',
    bio.english ? section('profile-english', bio.chinese ? '02' : '01', 'ENGLISH PROFILE', 'English biography', bio.english, 'en') : '',
  ].join('') || section('profile-about', '01', 'BIOGRAPHY', '个人介绍', '<p class="profile-empty">详细介绍尚未补充。</p>');
  const sidebar = `<aside class="profile-sidebar" aria-label="成员资料导航"><div class="profile-side-card"><div class="profile-overline">ON THIS PAGE</div><h2>本页导航</h2><nav class="profile-section-nav">${bio.chinese || !bio.english ? '<a href="#profile-about">个人介绍 <span>↗</span></a>' : ''}${bio.english ? '<a href="#profile-english">English biography <span>↗</span></a>' : ''}${bio.emails.length || bio.links.length ? '<a href="#profile-contact">联系与链接 <span>↗</span></a>' : ''}</nav></div>${bio.emails.length || bio.links.length ? `<section class="profile-side-card" id="profile-contact" aria-labelledby="profile-contact-title"><div class="profile-overline">CONNECT</div><h2 id="profile-contact-title">联系与链接</h2>${bio.emails.map(email => `<a class="profile-contact-link" href="mailto:${e(email)}"><span>联系邮箱</span><strong>${e(email)}</strong></a>`).join('')}${bio.links.map(link => `<a class="profile-contact-link" href="${e(link.href)}" target="_blank" rel="noopener noreferrer"><span>${e(link.label)} <span aria-hidden="true">↗</span></span><small>${e(link.host)}</small></a>`).join('')}</section>` : ''}<a class="profile-back-link" href="team.html"><span aria-hidden="true">←</span> 返回团队成员</a></aside>`;
  return hero + `<section class="profile-content"><div class="container profile-layout"><div class="profile-main">${sections}${bio.source ? `<div class="profile-source">${bio.source}</div>` : ''}</div>${sidebar}</div></section>`;
}
