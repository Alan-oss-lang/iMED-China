import additions from '../content/import-2026-10.json' with { type: 'json' };

const normalizedTitle = title => String(title).normalize('NFKC').replace(/[\s\p{P}]/gu, '').toLowerCase();

// A deployment import is additive and recorded once, including skipped duplicates.
// Its marker survives edits, withdrawals and deletions, so they are never undone.
export function applyContentImports(original) {
  if (original.appliedContentImports?.includes(additions.id)) return { state: original, changed: false };
  const state = structuredClone(original);
  let added = 0;
  for (const item of additions.news) {
    const duplicate = Object.values(state.collections.news).some(existing =>
      existing.id === item.id || (existing.category === item.category && normalizedTitle(existing.title) === normalizedTitle(item.title)));
    if (!duplicate) { state.collections.news[item.id] = structuredClone(item); added++; }
  }
  state.appliedContentImports = [...(state.appliedContentImports || []), additions.id];
  state.version += 1;
  state.history = [...(state.history || []), { id: additions.id, action: 'import', collection: 'news', title: `补充导入讲座海报和 MICCAI 2026 新闻稿（${added} 项）`, user: '网站内容升级', at: new Date().toISOString() }].slice(-200);
  return { state, changed: true };
}
