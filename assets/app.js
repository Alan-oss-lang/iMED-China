(() => {
  'use strict';
  window.addEventListener('hashchange', () => { if (/(?:invite_token|recovery_token|confirmation_token)=/.test(location.hash)) location.replace((document.body.dataset.base || '/') + 'admin/' + location.hash); });
  if (/(?:invite_token|recovery_token|confirmation_token)=/.test(location.hash)) {
    location.replace((document.body.dataset.base || '/') + 'admin/' + location.hash);
    return;
  }
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const base = document.body.dataset.base || '';
  const menu = $('[data-menu]');
  const nav = $('#main-nav');
  const closeMenu = () => { nav?.classList.remove('is-open'); menu?.setAttribute('aria-expanded', 'false'); menu?.setAttribute('aria-label', '打开导航'); };
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
    nav.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  document.addEventListener('click', e => { if (!e.target.closest('.site-header')) closeMenu(); });
  window.matchMedia('(min-width:1001px)').addEventListener('change', e => { if (e.matches) closeMenu(); });
  const topButton = $('[data-backtop]');
  const updateTop = () => { if (topButton) topButton.hidden = window.scrollY < 500; };
  window.addEventListener('scroll', updateTop, { passive: true });
  updateTop();
  topButton?.addEventListener('click', () => window.scrollTo({top:0, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}));

  // Search the published backend content; the original archive remains usable as local files.
  const dialog = $('#search-dialog');
  const input = $('#site-search');
  const results = $('#search-results');
  const summary = $('#search-summary');
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let searchSequence = 0, searchTimer, searchController;
  const renderSearch = async () => {
    const sequence = ++searchSequence;
    searchController?.abort();
    const query = input.value.trim().toLowerCase();
    if (!query) { results.innerHTML = ''; summary.textContent = '试试搜索：医学分割、MICCAI、ROSE、赵一天'; return; }
    if (query.length > 200) { summary.textContent = '搜索关键词请控制在 200 个字符以内。'; results.innerHTML = ''; return; }
    let found, total;
    if (location.protocol === 'file:') {
      const terms = query.split(/\s+/);
      found = (window.IMED_SEARCH || []).filter(item => terms.every(term => (item.title + ' ' + item.text).toLowerCase().includes(term))).sort((a,b) => Number(b.title.toLowerCase().includes(query))-Number(a.title.toLowerCase().includes(query)));
      total = found.length;
    } else {
      searchController = new AbortController();
      summary.textContent = '正在搜索…';
      try {
        const response = await fetch(`${base}api/search?q=${encodeURIComponent(query)}`, { signal: searchController.signal });
        if (!response.ok) throw new Error('Search unavailable');
        const data = await response.json();
        found = data.items; total = data.total;
      } catch (error) {
        if (sequence !== searchSequence || error.name === 'AbortError') return;
        summary.textContent = '搜索暂时不可用，请稍后重试。'; results.innerHTML = ''; return;
      }
    }
    if (sequence !== searchSequence) return;
    summary.textContent = total ? `找到 ${total} 条相关内容${total > 40 ? '，显示前 40 条，请增加关键词缩小范围' : ''}` : '没有找到相关内容，请尝试其他关键词。';
    results.innerHTML = found.slice(0,40).map(item => `<a class="search-result" href="${base}${esc(item.url)}"><h3>${esc(item.title)}</h3><p>${esc(item.category)}${item.date ? ' · ' + esc(item.date) : ''}</p></a>`).join('');
  };
  $$('[data-search-open]').forEach(button => button.addEventListener('click', () => { closeMenu(); dialog.showModal(); input.focus(); renderSearch(); }));
  $('[data-search-close]')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', e => { if (e.target === dialog) { const r=dialog.getBoundingClientRect(); if (e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) dialog.close(); } });
  input?.addEventListener('input', () => { clearTimeout(searchTimer); searchSequence++; searchController?.abort(); searchTimer = setTimeout(renderSearch, 200); });

  $$('[data-home-category]').forEach(button => button.addEventListener('click', () => {
    $$('[data-home-category]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    const category = button.dataset.homeCategory;
    let shown = 0;
    $$('[data-home-news]').forEach(row => { const visible = (category === '全部' || row.dataset.category === category) && shown < 4; row.hidden = !visible; if (visible) shown++; });
  }));
  $('[data-home-category="全部"]')?.click();

  // Shared category, keyword, year and pagination controls on the news/team pages.
  const collection = $('[data-collection]');
  if (collection) {
    const cards = $$('[data-item]', collection);
    const controls = $('[data-filters]');
    const search = $('[data-list-search]');
    const year = $('[data-year]');
    const count = $('[data-count]');
    const empty = $('[data-empty]');
    const pagination = $('[data-pagination]');
    const pageSize = Number(collection.dataset.pageSize || 1000);
    let category = '全部', page = 1;
    const render = () => {
      const query = (search?.value || '').trim().toLowerCase();
      const filtered = cards.filter(card => (category === '全部' || card.dataset.category === category) && (!year?.value || card.dataset.year === year.value) && (!query || card.textContent.toLowerCase().includes(query)));
      const totalPages = Math.max(1, Math.ceil(filtered.length/pageSize));
      page = Math.min(page, totalPages);
      const visible = new Set(filtered.slice((page-1)*pageSize,page*pageSize));
      cards.forEach(card => card.hidden = !visible.has(card));
      if (count) count.textContent = `共 ${filtered.length} ${collection.dataset.unit || '条内容'}`;
      if (empty) empty.hidden = filtered.length !== 0;
      if (pagination) { pagination.hidden = totalPages <= 1; $('[data-page-label]').textContent = `${page} / ${totalPages}`; $('[data-prev]').disabled = page <= 1; $('[data-next]').disabled = page >= totalPages; }
    };
    controls?.addEventListener('click', e => { const button = e.target.closest('[data-category]'); if(!button) return; category=button.dataset.category; page=1; $$('[data-category]',controls).forEach(b=>b.setAttribute('aria-pressed',String(b===button))); render(); });
    search?.addEventListener('input', () => {page=1;render();});
    year?.addEventListener('change', () => {page=1;render();});
    $('[data-prev]')?.addEventListener('click', () => {page--;render();collection.scrollIntoView({block:'start'});});
    $('[data-next]')?.addEventListener('click', () => {page++;render();collection.scrollIntoView({block:'start'});});
    const initial = new URLSearchParams(location.search).get('category');
    const initialButton = $$('[data-category]',controls || document).find(b=>b.dataset.category===initial);
    if(initialButton) {category=initial;$$('[data-category]',controls).forEach(b=>b.setAttribute('aria-pressed',String(b===initialButton)));}
    render();
  }
})();
