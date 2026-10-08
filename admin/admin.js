(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const labels = { dashboard: '概览', news: '新闻与活动', members: '团队成员', publications: '科研成果', resources: '数据资源', pages: '页面内容' };
  let mode, section = 'dashboard', page = 1, total = 0, current = null, currentCollection, dirty = false, selection, uploadTarget;
  let session = null, listGeneration = 0, searchTimer, saving = false, uploading = false;
  try { session = JSON.parse(sessionStorage.getItem('imed_identity') || 'null'); } catch { sessionStorage.removeItem('imed_identity'); }
  const hash = new URLSearchParams(location.hash.slice(1));
  let verification = hash.has('invite_token') ? { type: 'invite', token: hash.get('invite_token') } : hash.has('recovery_token') ? { type: 'recovery', token: hash.get('recovery_token') } : hash.has('confirmation_token') ? { type: 'signup', token: hash.get('confirmation_token') } : null;
  if (verification) history.replaceState(null, '', location.pathname);
  window.addEventListener('hashchange', () => { if (/(?:invite_token|recovery_token|confirmation_token)=/.test(location.hash)) location.reload(); });
  function notice(message, error = false) { $('#notice').textContent = message; $('#notice').dataset.error = String(error); $('#notice').hidden = !message; }
  function retainSession(data) {
    session = { access_token: data.access_token, refresh_token: data.refresh_token, expires: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
    sessionStorage.setItem('imed_identity', JSON.stringify(session));
  }
  async function identity(path, body, token) {
    const isToken = path === 'token';
    const fields = isToken && body.email ? { ...body, username: body.email } : body;
    const response = await fetch('/.netlify/identity/' + path, { method: path === 'user' ? 'PUT' : 'POST', headers: { 'Content-Type': isToken ? 'application/x-www-form-urlencoded' : 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: isToken ? new URLSearchParams(fields).toString() : JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(path === 'token' ? '邮箱或密码错误，或账号尚未确认' : path === 'verify' ? '邀请或重置链接已失效，请重新获取' : '登录服务暂时无法完成操作');
    return data;
  }
  let refreshing;
  async function refreshSession() {
    if (!session?.refresh_token) throw new Error('登录已失效，请重新登录');
    refreshing ||= identity('token', { grant_type: 'refresh_token', refresh_token: session.refresh_token }).then(retainSession).finally(() => { refreshing = null; });
    return refreshing;
  }
  async function api(path, options = {}, retry = true) {
    if (mode === 'identity' && session && session.expires < Date.now() + 30000) await refreshSession();
    const response = await fetch('/api/' + path, { ...options, credentials: 'same-origin', headers: { ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(mode === 'identity' && session ? { Authorization: 'Bearer ' + session.access_token } : {}), ...options.headers } });
    if (response.status === 401 && mode === 'identity' && session?.refresh_token && retry) { await refreshSession(); return api(path, options, false); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || '操作失败，请稍后重试'); error.status = response.status; throw error; }
    return data;
  }
  function logoutView() {
    session = null; sessionStorage.removeItem('imed_identity');
    $('#workspace').hidden = true; $('#login-panel').hidden = false; $('#logout').hidden = true; $('#account').textContent = '';
  }
  async function signedIn() {
    const { user } = await api('auth/me');
    $('#login-panel').hidden = true; $('#workspace').hidden = false; $('#logout').hidden = false; $('#account').textContent = user.name;
    $('#password').value = ''; notice(''); await navigate(section);
  }
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault(); $('#login-submit').disabled = true; notice('');
    try {
      const username = $('#username').value.trim(), password = $('#password').value;
      if (verification) {
        if (password.length < 12 || password !== $('#confirm-password').value) throw new Error('请使用至少 12 位密码，并确认两次输入一致');
        const verified = await identity('verify', { ...verification, ...(verification.type !== 'recovery' ? { type: 'signup', password } : {}) });
        if (verification.type === 'recovery') await identity('user', { password }, verified.access_token);
        retainSession(verified); verification = null;
        $('#username-label').hidden = false; $('#username').required = true; $('#username').value = verified.user?.email || '';
        $('#confirm-label').hidden = true; $('#confirm-password').required = false; $('#confirm-password').value = '';
        $('#password').autocomplete = 'current-password'; $('#recover').hidden = false; $('#login-title').textContent = '管理网站内容'; $('#login-submit').textContent = '登录管理后台';
      } else if (mode === 'local') await api('auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      else retainSession(await identity('token', { grant_type: 'password', email: username, password }));
      await signedIn();
    } catch (error) { notice(error.message, true); } finally { $('#login-submit').disabled = false; }
  });
  $('#recover').addEventListener('click', async () => {
    const email = $('#username').value.trim();
    if (!email || !$('#username').checkValidity()) { notice('请先输入你的账号邮箱', true); return; }
    $('#recover').disabled = true;
    try { await identity('recover', { email }); notice('如果该邮箱已注册，将收到密码重置邮件。'); } catch (error) { notice(error.message, true); } finally { $('#recover').disabled = false; }
  });
  $('#logout').addEventListener('click', async () => {
    if (dirty && !confirm('内容尚未保存，确定退出？')) return;
    try {
      if (mode === 'identity' && session) await identity('logout', {}, session.access_token);
      await api('auth/logout', { method: 'POST' });
      $('#editor-dialog').close(); dirty = false; logoutView();
    } catch (error) { notice(error.message, true); }
  });
  async function navigate(nextSection) {
    section = nextSection; page = 1; $('#filter-query').value = ''; $('#filter-status').value = '';
    $('#section-title').textContent = labels[section]; $('#add').hidden = section === 'dashboard';
    document.querySelectorAll('[data-section]').forEach(button => button.setAttribute('aria-current', button.dataset.section === section ? 'page' : 'false'));
    $('#dashboard').hidden = section !== 'dashboard'; $('#listing').hidden = section === 'dashboard';
    try { if (section === 'dashboard') await dashboard(); else await list(); } catch (error) { notice(error.message, true); }
  }
  document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.section)));
  async function dashboard() {
    const data = await api('admin/dashboard'); if (section !== 'dashboard') return;
    const actions = { create: '新增', update: '修改', delete: '删除', upload: '上传图片' };
    $('#dashboard').innerHTML = `<div class="stat-grid">${Object.entries(data.counts).map(([key, count]) => `<div class="stat-card">${esc(labels[key])}<strong>${count.total}</strong><span>${count.published} 项已发布</span></div>`).join('')}</div><div class="audit-panel"><h2>最近操作</h2>${data.history.length ? data.history.map(row => `<div class="audit-row">${esc(actions[row.action])} · ${esc(row.title)}<small>${esc(row.user)} · ${esc(new Date(row.at).toLocaleString('zh-CN'))}</small></div>`).join('') : '<p class="muted">目前还没有编辑记录。现有网站内容已导入，可以开始维护。</p>'}</div>`;
  }
  async function list() {
    const generation = ++listGeneration, collection = section;
    $('#list-count').textContent = '正在加载…'; $('#rows').innerHTML = '';
    const params = new URLSearchParams({ page, limit: 20, q: $('#filter-query').value, status: $('#filter-status').value });
    const data = await api('admin/' + collection + '?' + params);
    if (generation !== listGeneration || collection !== section) return;
    total = data.total;
    if (page > 1 && (page - 1) * 20 >= total) { page = Math.max(1, Math.ceil(total / 20)); return list(); }
    $('#list-count').textContent = `共 ${total} 项内容`;
    $('#rows').innerHTML = data.items.map(item => `<tr><td><strong>${esc(item.title)}</strong><small>${esc(item.date || item.category || item.journal || item.subtitle || item.slug || '')}</small></td><td><span class="status ${item.status}">${item.status === 'published' ? '已发布' : '草稿'}</span></td><td><div class="row-actions"><button class="small-button" data-edit="${esc(item.id)}">编辑</button><button class="small-button danger" data-delete="${esc(item.id)}" data-revision="${item.revision}">删除</button></div></td></tr>`).join('') || '<tr><td colspan="3">暂无符合条件的内容。</td></tr>';
    $('#page-label').textContent = `${page} / ${Math.max(1, Math.ceil(total / 20))}`; $('#previous').disabled = page <= 1; $('#next').disabled = page * 20 >= total;
  }
  const loadList = () => list().catch(error => notice(error.message, true));
  $('#filter-query').addEventListener('input', () => { clearTimeout(searchTimer); page = 1; searchTimer = setTimeout(loadList, 250); });
  $('#filter-status').addEventListener('change', () => { page = 1; loadList(); });
  $('#refresh').addEventListener('click', loadList);
  $('#previous').addEventListener('click', () => { page--; loadList(); }); $('#next').addEventListener('click', () => { page++; loadList(); });
  $('#rows').addEventListener('click', async event => {
    const edit = event.target.closest('[data-edit]'), remove = event.target.closest('[data-delete]');
    try {
      if (edit) { edit.disabled = true; const collection = section; const { item } = await api('admin/' + collection + '/' + edit.dataset.edit); if (collection === section) openEditor(item); }
      if (remove) {
        const title = remove.closest('tr').querySelector('strong').textContent;
        if (!confirm(`确定删除“${title}”？前台会同步移除。删除前可下载内容备份。`)) return;
        remove.disabled = true;
        await api('admin/' + section + '/' + remove.dataset.delete, { method: 'DELETE', headers: { 'X-IMED-Revision': remove.dataset.revision } });
        notice('内容已删除'); await list();
      }
    } catch (error) { notice(error.message, true); } finally { if (edit) edit.disabled = false; if (remove) remove.disabled = false; }
  });
  function field(name, label, value = '', options = {}) {
    const { wide = false, type = 'text', required = false, choices, max = 500, readOnly = false, hint = '' } = options;
    const attrs = `name="${name}" id="field-${name}"${required ? ' required' : ''}${readOnly ? ' readonly' : ''} maxlength="${max}"`;
    const input = choices ? `<select ${attrs}>${choices.map(c => `<option value="${esc(c)}"${c === value ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>` : type === 'textarea' ? `<textarea ${attrs}>${esc(value)}</textarea>` : `<input type="${type}" ${attrs} value="${esc(value)}">`;
    return `<label class="${wide ? 'wide' : ''}">${esc(label)}${input}${hint ? `<p class="form-note">${esc(hint)}</p>` : ''}</label>`;
  }
  function openEditor(item = null) {
    current = item; currentCollection = section; dirty = false; selection = null;
    const r = item || {}, c = currentCollection;
    $('#editor-title').textContent = (item ? '编辑' : '新增') + ' · ' + labels[c];
    let fields = field('title', c === 'members' ? '姓名' : '标题', r.title, { wide: true, required: true });
    if (c === 'news') fields += field('date', '发布日期', r.date || new Date().toLocaleDateString('sv-SE'), { type: 'date', required: true }) + field('category', '分类', r.category || '团队活动', { choices: ['论文发表', '学术活动', '团队活动'] }) + field('summary', '摘要', r.summary, { wide: true, type: 'textarea', max: 2000 }) + field('sourceUrl', '原始资料链接（可选）', r.sourceUrl, { wide: true, max: 2000 });
    if (c === 'members') fields += field('englishName', '英文姓名', r.englishName, { max: 200 }) + field('category', '成员分组', r.category || '研究人员', { choices: ['研究人员', '在读学生', '客聘专家', '毕业校友'] }) + field('role', '职务／介绍', r.role, { wide: true, type: 'textarea', max: 2000 }) + `<label class="wide">成员照片<div class="image-field"><input id="field-image" name="image" value="${esc(r.image || '')}" maxlength="2000"><button type="button" id="upload-photo" class="small-button">上传照片</button></div>${r.image ? `<img class="thumbnail" id="member-photo" src="${esc(r.image)}" alt="照片预览">` : '<img class="thumbnail" id="member-photo" alt="照片预览" hidden>'}</label>` + field('link', '个人介绍链接（可选）', r.link, { max: 2000 }) + field('order', '显示顺序', r.order ?? 0, { type: 'number', hint: '数字越小越靠前，可使用负数。' });
    if (c === 'publications') fields += field('journal', '期刊／会议', r.journal, { required: true, max: 300 }) + field('year', '年份', r.year || String(new Date().getFullYear()), { required: true, max: 4 }) + field('description', '作者／研究主题／发表说明', r.description, { type: 'textarea', wide: true, max: 2000 }) + field('link', '论文或详情链接（可选）', r.link, { max: 2000 }) + field('order', '显示顺序', r.order ?? 0, { type: 'number' });
    if (c === 'resources') fields += field('subtitle', '研究用途／副标题', r.subtitle, { wide: true }) + field('description', '资源说明', r.description, { wide: true, type: 'textarea', max: 5000 }) + field('availability', '开放状态', r.availability || '学术研究', { required: true, max: 100, hint: '例如：学术研究、下载待开放、已停止下载。' }) + field('order', '显示顺序', r.order ?? 0, { type: 'number' }) + field('link', '资源说明或下载链接（可选）', r.link, { wide: true, max: 2000 });
    if (c === 'pages') fields += field('slug', '页面地址', r.slug, { required: true, readOnly: Boolean(item), max: 100, hint: '例如 cooperation.html。已有页面地址保持不变。' }) + field('description', '搜索摘要', r.description, { max: 2000 });
    $('#editor-fields').innerHTML = fields;
    $('#rich-section').hidden = !['news', 'pages'].includes(c); $('#preview').hidden = $('#rich-section').hidden;
    $('#rich-editor').innerHTML = r.bodyHtml || '<p><br></p>';
    $('#rich-editor').querySelectorAll('[data-imed-slot]').forEach(el => el.contentEditable = 'false');
    $('#editor-status').value = r.status || 'draft'; $('#editor-status').disabled = c === 'pages' && r.slug === 'index.html';
    $('#editor-error').hidden = true; $('#save').disabled = false; $('#editor-dialog').showModal();
    $('#field-title').focus();
    $('#upload-photo')?.addEventListener('click', () => chooseImage('photo'));
  }
  $('#add').addEventListener('click', () => openEditor());
  const closeEditor = () => { if (saving || uploading) { showEditorError('正在保存或上传，请稍候。'); return; } if (!dirty || confirm('还有未保存的修改，确定关闭？')) { $('#editor-dialog').close(); dirty = false; } };
  $('#close-editor').addEventListener('click', closeEditor);
  $('#editor-dialog').addEventListener('cancel', event => { event.preventDefault(); closeEditor(); });
  $('#editor-form').addEventListener('input', () => { dirty = true; });
  function showEditorError(message) { $('#editor-error').textContent = message; $('#editor-error').hidden = false; }
  $('#editor-form').addEventListener('submit', async event => {
    event.preventDefault(); if (saving || uploading) return;
    const input = Object.fromEntries(new FormData($('#editor-form'))); input.status = $('#editor-status').value;
    if (['news', 'pages'].includes(currentCollection)) input.bodyHtml = $('#rich-editor').innerHTML;
    if (current?.status === 'published' && input.status === 'draft' && !confirm('保存为草稿后，这项内容会从前台撤下。确定继续？')) return;
    saving = true; $('#save').disabled = true; $('#editor-error').hidden = true;
    try {
      await api('admin/' + currentCollection + (current ? '/' + current.id : ''), { method: current ? 'PUT' : 'POST', headers: current ? { 'X-IMED-Revision': String(current.revision) } : {}, body: JSON.stringify(input) });
      dirty = false; $('#editor-dialog').close(); notice(input.status === 'published' ? '已保存并发布，前台已同步更新' : '草稿已保存，前台不显示'); await list();
    } catch (error) { showEditorError(error.message); } finally { saving = false; $('#save').disabled = false; }
  });
  document.addEventListener('selectionchange', () => {
    const selected = window.getSelection();
    if (selected.rangeCount && $('#rich-editor').contains(selected.anchorNode)) selection = selected.getRangeAt(0).cloneRange();
  });
  function restoreSelection() { $('#rich-editor').focus(); if (selection && $('#rich-editor').contains(selection.commonAncestorContainer)) { const selected = window.getSelection(); selected.removeAllRanges(); selected.addRange(selection); } }
  $('.rich-toolbar').addEventListener('mousedown', event => { if (event.target.closest('button')) event.preventDefault(); });
  $('.rich-toolbar').addEventListener('click', event => {
    const button = event.target.closest('[data-command],[data-format]'); if (!button) return;
    restoreSelection(); document.execCommand(button.dataset.command || 'formatBlock', false, button.dataset.format || null); dirty = true;
  });
  $('#insert-link').addEventListener('click', () => {
    const value = prompt('输入链接地址（https://… 或站内页面地址）'); if (!value) return;
    if (!/^(https?:\/\/|mailto:|tel:|\/[^/]|#|[a-zA-Z0-9][a-zA-Z0-9_./?#=&%+-]*$)/.test(value) || /[\x00-\x20\\]/.test(value)) { showEditorError('请输入有效的网络或站内链接'); return; }
    restoreSelection(); document.execCommand('createLink', false, value); dirty = true;
  });
  $('#rich-editor').addEventListener('paste', event => {
    event.preventDefault(); restoreSelection(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); dirty = true;
  });
  $('#rich-editor').addEventListener('drop', event => event.preventDefault());
  function chooseImage(target) { if (uploading) return; uploadTarget = target; if (target === 'body') restoreSelection(); $('#image-file').value = ''; $('#image-file').click(); }
  $('#insert-image').addEventListener('click', () => chooseImage('body'));
  $('#image-file').addEventListener('change', async () => {
    const file = $('#image-file').files[0]; if (!file) return;
    if (file.size > 4 * 1024 * 1024) { showEditorError('图片需小于 4 MB'); return; }
    uploading = true; $('#save').disabled = true; showEditorError('正在上传图片…');
    try {
      const { item } = await api('admin/media', { method: 'POST', headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) }, body: file });
      if (uploadTarget === 'photo') { $('#field-image').value = item.url; $('#member-photo').src = item.url; $('#member-photo').hidden = false; }
      else { restoreSelection(); document.execCommand('insertHTML', false, `<img src="${esc(item.url)}" alt="${esc(file.name)}">`); }
      dirty = true; $('#editor-error').hidden = true;
    } catch (error) { showEditorError(error.message); } finally { uploading = false; $('#save').disabled = false; }
  });
  $('#preview').addEventListener('click', () => {
    const body = $('#rich-editor').innerHTML;
    $('#preview-frame').srcdoc = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><base href="${esc(location.origin + '/')}"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/styles.css"></head><body><main class="container article-body" style="padding:30px"><h1>${esc($('#field-title').value)}</h1>${body}</main></body></html>`;
    $('#preview-dialog').showModal();
  });
  $('#close-preview').addEventListener('click', () => $('#preview-dialog').close());
  $('#export').addEventListener('click', async () => {
    try {
      const data = await api('admin/export'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'imed-content-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) { notice(error.message, true); }
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  async function init() {
    try {
      const config = await api('auth/config'); mode = config.mode;
      $('#login-submit').textContent = verification ? '设置密码并登录' : '登录管理后台'; $('#login-submit').disabled = !config.configured;
      $('#login-note').textContent = mode === 'local' ? '本地账号由项目管理员创建。首次使用请运行 npm run setup。' : '使用本站 Netlify Identity 账号登录。需要 admin/editor 角色或管理员邮箱白名单。';
      if (mode === 'identity') { $('#username').type = 'email'; $('#username').placeholder = '你的账号邮箱'; $('#recover').hidden = false; }
      if (verification && mode === 'identity') {
        $('#login-title').textContent = verification.type !== 'recovery' ? '激活管理账号' : '设置新密码';
        $('#login-description').textContent = '设置至少 12 位密码后，即可登录管理后台。';
        $('#username-label').hidden = true; $('#username').required = false; $('#confirm-label').hidden = false; $('#confirm-password').required = true; $('#password').autocomplete = 'new-password'; $('#recover').hidden = true;
      }
      if (!config.configured) { notice('登录服务尚未配置，请查看项目 README 的运行说明', true); return; }
      if (!verification) { try { await signedIn(); } catch (error) { if (error.status !== 401) notice(error.message, true); } }
    } catch (error) { $('#login-submit').textContent = '暂时无法连接'; notice('无法连接内容管理服务。请通过项目后端启动，或检查 Netlify 部署。', true); }
  }
  init();
})();
