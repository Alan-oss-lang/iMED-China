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
  await expect(page.locator('#list-count')).toHaveText('共 359 项内容');
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
  await expect(page.locator('#list-count')).toHaveText('共 360 项内容');
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
