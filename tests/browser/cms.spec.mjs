import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function login(page) {
  await page.goto('/admin/');
  await expect(page.getByRole('button', { name: '登录管理后台' })).toBeEnabled();
  await page.locator('#username').fill('browser-test'); await page.locator('#password').fill('Browser-test-password-123');
  await page.getByRole('button', { name: '登录管理后台' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
  await expect(page.locator('.stat-card')).toHaveCount(5);
}
test('浏览器中完成新闻新增、预览、发布、前台搜索、撤下和删除', async ({ page, context }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await login(page);
  await page.getByRole('button', { name: '新闻与活动', exact: true }).click();
  await expect(page.locator('#list-count')).toHaveText('共 422 项内容');
  await page.getByRole('button', { name: '新增内容', exact: true }).click();
  await page.locator('#field-title').fill('浏览器闭环验证新闻');
  await page.locator('#field-date').fill('2026-10-08');
  await page.locator('#field-summary').fill('从管理后台发布到前台。');
  await page.locator('#rich-editor').fill('浏览器验证正文内容。');
  await page.getByRole('button', { name: '预览正文', exact: true }).click();
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: '浏览器闭环验证新闻' })).toBeVisible();
  await page.locator('#close-preview').click();
  await page.locator('#editor-status').selectOption('published'); await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#editor-dialog')).not.toBeVisible();
  await expect(page.locator('#list-count')).toHaveText('共 423 项内容');
  const front = await context.newPage(); await front.goto('/news.html');
  await expect(front.getByRole('heading', { name: '浏览器闭环验证新闻' })).toBeVisible();
  await front.getByRole('heading', { name: '浏览器闭环验证新闻' }).click();
  await expect(front.locator('.article-body')).toContainText('浏览器验证正文内容。');
  const articleUrl = front.url();
  await front.getByRole('button', { name: '搜索', exact: true }).click();
  await front.locator('#site-search').fill('浏览器闭环验证新闻');
  await expect(front.locator('#search-summary')).toHaveText('找到 1 条相关内容');
  await page.locator('#filter-query').fill('浏览器闭环验证新闻');
  await expect(page.locator('#list-count')).toHaveText('共 1 项内容');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.locator('#editor-status').selectOption('draft');
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.status')).toHaveText('草稿');
  expect((await front.goto(articleUrl)).status()).toBe(404);
  await front.goto('/news.html'); await expect(front.getByRole('heading', { name: '浏览器闭环验证新闻' })).toHaveCount(0);
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.locator('#list-count')).toHaveText('共 0 项内容');
  await front.close(); expect(errors).toEqual([]);
});

test('成员照片上传、保存已有成员及四种编辑器正常运行', async ({ page, context }) => {
  await login(page);
  await page.getByRole('button', { name: '团队成员', exact: true }).click();
  await page.getByRole('button', { name: '新增内容', exact: true }).click();
  await page.locator('#field-title').fill('浏览器测试成员'); await page.locator('#field-englishName').fill('Browser Member');
  await page.locator('#field-role').fill('科研成员');
  await page.locator('#upload-photo').click();
  await page.locator('#image-file').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
  await expect(page.locator('#field-image')).toHaveValue(/\/api\/media\//); await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#editor-status').selectOption('published'); await page.locator('#save').click();
  await expect(page.locator('#editor-dialog')).not.toBeVisible();
  await page.locator('#filter-query').fill('浏览器测试成员'); await expect(page.locator('#list-count')).toHaveText('共 1 项内容');
  const writes = [];
  // Reproduce the edge dropping standard conditional request headers.
  await page.route('**/api/admin/members/*', async route => {
    const request = route.request(), headers = await request.allHeaders();
    if (['PUT', 'DELETE'].includes(request.method())) {
      writes.push({ method: request.method(), revision: headers['x-imed-revision'] });
      delete headers['if-match'];
    }
    await route.continue({ headers });
  });
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.locator('#field-role').fill('已保存的成员介绍');
  await page.locator('#field-category').selectOption('在读学生');
  await page.locator('#save').click();
  await expect(page.locator('#editor-dialog')).not.toBeVisible();
  const front = await context.newPage(); await front.goto('/team');
  await expect(front.locator('.person-card').filter({ hasText: '浏览器测试成员' })).toContainText('已保存的成员介绍');
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '删除', exact: true }).click(); await expect(page.locator('#list-count')).toHaveText('共 0 项内容');
  expect(writes).toEqual([{ method: 'PUT', revision: '1' }, { method: 'DELETE', revision: '2' }]);
  await front.reload(); await expect(front.locator('.person-card').filter({ hasText: '浏览器测试成员' })).toHaveCount(0); await front.close();
  for (const label of ['科研成果', '数据资源', '页面内容']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('#rows tr').first()).toBeVisible(); await page.getByRole('button', { name: '编辑', exact: true }).first().click();
    await expect(page.locator('#field-title')).not.toBeEmpty(); await page.locator('#close-editor').click();
  }
  await page.locator('#filter-query').fill('首页'); await expect(page.locator('#list-count')).toHaveText('共 1 项内容');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await expect(page.locator('#rich-editor [data-imed-slot]')).toHaveCount(4); await expect(page.locator('#editor-status')).toBeDisabled();
  await page.locator('#close-editor').click();
});

test('前台筛选分页、后台移动布局及桌面布局', async ({ page }) => {
  for (const path of ['/content/seed.json', '/.env.local', '/assets/search-index.js', '/server/app.mjs']) expect((await page.request.get(path)).status()).toBe(404);
  await page.goto('/news.html'); await expect(page.locator('[data-item]:visible')).toHaveCount(12);
  await page.getByRole('button', { name: '学术活动', exact: true }).click();
  await expect(page.locator('[data-count]')).toContainText('条动态');
  await page.locator('[data-list-search]').fill('七十三讲'); await expect(page.locator('[data-item]:visible')).toHaveCount(1);
  await page.goto('/'); await expect(page.locator('[data-home-news]:visible')).toHaveCount(4);
  await page.locator('.team-preview-photo').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.team-preview-photo img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await page.evaluate(() => scrollTo(0, 0));
  await mkdir('var/screenshots', { recursive: true }); await page.screenshot({ path: 'var/screenshots/home-desktop.png', fullPage: true });
  await login(page); await page.screenshot({ path: 'var/screenshots/admin-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'var/screenshots/admin-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Identity 的账号登录和邀请激活使用正确的 GoTrue 请求格式', async ({ page }) => {
  const captured = [];
  await page.route('**/api/auth/config', r => r.fulfill({ json: { mode: 'identity', configured: true } }));
  await page.route('**/api/auth/me', r => r.request().headers().authorization ? r.fulfill({ json: { user: { id: 'identity-test', name: 'owner@example.test', roles: ['admin'] } } }) : r.fulfill({ status: 401, json: { error: '请先登录' } }));
  await page.route('**/.netlify/identity/**', r => {
    captured.push({ url: r.request().url(), headers: r.request().headers(), body: r.request().postData() });
    return r.fulfill({ json: { access_token: 'verified-token', refresh_token: 'refresh-test', expires_in: 3600 } });
  });
  await page.goto('/admin/'); await page.locator('#username').fill('owner@example.test'); await page.locator('#password').fill('p&a密碼123456789'); await page.locator('#login-submit').click();
  await expect(page.locator('#workspace')).toBeVisible();
  const loginRequest = captured[0]; expect(loginRequest.headers['content-type']).toBe('application/x-www-form-urlencoded');
  const params = new URLSearchParams(loginRequest.body); expect(params.get('username')).toBe('owner@example.test'); expect(params.get('password')).toBe('p&a密碼123456789');
  await page.goto('/admin/#invite_token=invite-test'); await page.locator('#password').fill('invited-password-123'); await page.locator('#confirm-password').fill('invited-password-123'); await page.locator('#login-submit').click();
  await expect(page.locator('#workspace')).toBeVisible();
  const invitation = captured.find(r => r.url.endsWith('/verify')); expect(JSON.parse(invitation.body)).toEqual({ type: 'signup', token: 'invite-test', password: 'invited-password-123' });
});

test('成员详情显示照片、中英文介绍和联系入口，并适配手机', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/team');
  await page.locator('.person-card').filter({ hasText: '赵一天' }).getByRole('link', { name: '个人介绍' }).click();
  await expect(page.locator('main h1')).toHaveText('赵一天');
  await expect(page.locator('.profile-role')).toContainText('团队负责人');
  await expect.poll(() => page.locator('.profile-portrait img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('#profile-about')).toContainText('眼、脑、血管疾病');
  await expect(page.locator('#profile-english')).toContainText('University of Liverpool');
  await expect(page.locator('.profile-contact-link[href="mailto:yitian.zhao@nimte.ac.cn"]')).toBeVisible();
  await mkdir('var/screenshots', { recursive: true });
  await page.screenshot({ path: 'var/screenshots/profile-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'var/screenshots/profile-mobile.png', fullPage: true });
  await page.locator('.profile-section-nav').getByRole('link', { name: 'English biography' }).click();
  await expect(page.locator('#profile-english-title')).toBeInViewport();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('海报墙支持检索、分页、大图，后台可上传、发布、撤下和删除海报', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.goto('/lectures');
  await expect(page.locator('[data-count]')).toHaveText('共 62 张海报');
  await expect(page.locator('.poster-card:visible')).toHaveCount(12);
  await expect(page.locator('[data-page-label]')).toHaveText('1 / 6');
  await page.locator('[data-next]').click();
  await expect(page.locator('[data-page-label]')).toHaveText('2 / 6');
  await page.locator('[data-list-search]').fill('Trusted AI');
  await expect(page.locator('.poster-card:visible')).toHaveCount(1);
  await page.locator('[data-list-search]').fill('');
  await mkdir('var/screenshots', { recursive: true });
  await page.screenshot({ path: 'var/screenshots/lectures-desktop.png' });
  await page.locator('[data-list-search]').fill('Trusted AI');
  await page.locator('.poster-copy h2:visible a').click();
  await expect(page.locator('.lecture-poster img')).toBeVisible();
  await expect.poll(() => page.locator('.lecture-poster img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: '下载海报', exact: false })).toHaveAttribute('download', '');
  await page.goto('/news.html');
  await page.locator('[data-filters] button[data-category="讲座海报"]').click();
  await expect(page.locator('[data-count]')).toHaveText('共 62 条动态');
  await page.screenshot({ path: 'var/screenshots/news-new-desktop.png' });
  await login(page);
  await page.getByRole('button', { name: '新闻与活动', exact: true }).click();
  await page.getByRole('button', { name: '新增内容', exact: true }).click();
  await page.locator('#field-title').fill('浏览器验证讲座海报');
  await page.locator('#field-category').selectOption('讲座海报');
  await expect(page.locator('#field-category option:checked')).toHaveText('iMED 分享会');
  await expect(page.locator('#upload-poster')).toBeVisible();
  await page.locator('#upload-poster').click();
  await page.locator('#image-file').setInputFiles('assets/media/lectures/lecture-63-thumb.webp');
  await expect(page.locator('#field-posterImage')).toHaveValue(/\/api\/media\//);
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#field-lectureNumber').fill('64');
  await page.getByRole('button', { name: '预览正文', exact: true }).click();
  await expect(page.frameLocator('#preview-frame').locator('.lecture-poster img')).toBeVisible();
  await page.locator('#close-preview').click();
  await page.locator('#editor-status').selectOption('published');
  await page.locator('#save').click(); await expect(page.locator('#editor-dialog')).not.toBeVisible();
  const front = await context.newPage(); await front.goto('/lectures.html');
  await front.locator('[data-list-search]').fill('浏览器验证讲座海报');
  await expect(front.locator('.poster-card:visible')).toHaveCount(1);
  await front.locator('.poster-copy h2:visible a').click();
  await expect.poll(() => front.locator('.lecture-poster img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  const articleUrl = front.url();
  await page.locator('#filter-query').fill('浏览器验证讲座海报');
  await expect(page.locator('#list-count')).toHaveText('共 1 项内容');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.locator('#editor-status').selectOption('draft');
  page.once('dialog', d => d.accept()); await page.locator('#save').click();
  await expect(page.locator('#editor-dialog')).not.toBeVisible();
  expect((await front.goto(articleUrl)).status()).toBe(404);
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.locator('#list-count')).toHaveText('共 0 项内容'); await front.close();
});

test('Logo 与放大后的导航、首页和海报页面在桌面及手机无横向溢出', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const width of [1920, 1440, 1280, 1024, 768, 720, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/', '/news.html', '/lectures.html', '/view-34080.html', '/team.html', '/research.html', '/publications.html', '/datasets.html']) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + ' at ' + width).toBe(true);
      await expect.poll(() => page.locator('.brand-logo').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
      const filterHeights = await page.locator('.filters button,.filters select,.filters .list-search').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
      if (filterHeights.length) expect(Math.max(...filterHeights) - Math.min(...filterHeights), 'filter alignment at ' + route + ' / ' + width).toBeLessThan(1);
      if (route === '/') {
        const quickLinks = await page.locator('.quick-item').evaluateAll(items => items.map(item => {
          const subtitle = item.querySelector('small'), title = item.querySelector('strong');
          const range = document.createRange(); range.selectNodeContents(subtitle);
          return { itemTop: item.getBoundingClientRect().top, titleTop: title.getBoundingClientRect().top,
            subtitleTop: subtitle.getBoundingClientRect().top, lines: range.getClientRects().length,
            fits: subtitle.scrollWidth <= subtitle.clientWidth + 1 };
        }));
        for (const item of quickLinks) { expect(item.lines, 'quick link at ' + width).toBe(1); expect(item.fits, 'quick link width at ' + width).toBe(true); }
        for (const item of quickLinks) for (const peer of quickLinks.filter(peer => Math.abs(peer.itemTop - item.itemTop) < 1)) {
          expect(Math.abs(item.titleTop - peer.titleTop)).toBeLessThan(1);
          expect(Math.abs(item.subtitleTop - peer.subtitleTop)).toBeLessThan(1);
        }
        const tabs = await page.locator('.news-tabs').evaluate(node => [...node.children].map(child => {
          const rect = child.getBoundingClientRect(); return { top: rect.top, height: rect.height };
        }));
        for (const tab of tabs) { expect(Math.abs(tab.top - tabs[0].top)).toBeLessThan(1); expect(Math.abs(tab.height - tabs[0].height)).toBeLessThan(1); }
        await expect(page.locator('.news-tabs a')).toHaveText('iMED 分享会 ↗');
      }
      if (route === '/news.html') await expect(page.locator('[data-filters] button[data-category="讲座海报"]')).toHaveText('iMED 分享会');
      if (route === '/lectures.html') await expect(page.locator('main h1')).toHaveText('iMED 分享会');
      if (route === '/' && width === 1440) {
        expect(await page.locator('.nav a').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(17);
        await page.screenshot({ path: 'var/screenshots/home-new-desktop.png', fullPage: true });
        await page.screenshot({ path: 'var/screenshots/home-aligned-desktop.png', fullPage: true });
      }
      if (width === 390 && route === '/') await page.screenshot({ path: 'var/screenshots/home-new-mobile.png', fullPage: true });
      if (width === 390 && route === '/lectures.html') await page.screenshot({ path: 'var/screenshots/lectures-mobile.png' });
    }
    if (width < 1201) {
      await page.getByRole('button', { name: '打开导航', exact: true }).click();
      await expect(page.locator('#main-nav')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
