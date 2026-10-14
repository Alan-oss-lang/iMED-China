import additions from '../content/import-2026-10.json' with { type: 'json' };
import memberNames from '../content/member-name-corrections.json' with { type: 'json' };

const normalizedTitle = title => String(title).normalize('NFKC').replace(/[\s\p{P}]/gu, '').toLowerCase();

// A deployment import is additive and recorded once, including skipped duplicates.
// Its marker survives edits, withdrawals and deletions, so they are never undone.
export function applyContentImports(original) {
  const importNews = !original.appliedContentImports?.includes(additions.id);
  const fixNames = !original.appliedContentImports?.includes(memberNames.id);
  if (!importNews && !fixNames) return { state: original, changed: false };
  const state = structuredClone(original);
  const at = new Date().toISOString();
  state.appliedContentImports ||= [];
  state.history ||= [];
  if (importNews) {
    let added = 0;
    for (const item of additions.news) {
      const duplicate = Object.values(state.collections.news).some(existing =>
        existing.id === item.id || (existing.category === item.category && normalizedTitle(existing.title) === normalizedTitle(item.title)));
      if (!duplicate) { state.collections.news[item.id] = structuredClone(item); added++; }
    }
    state.appliedContentImports.push(additions.id);
    state.history.push({ id: additions.id, action: 'import', collection: 'news', title: `补充导入讲座海报和 MICCAI 2026 新闻稿（${added} 项）`, user: '网站内容升级', at });
  }
  if (fixNames) {
    let corrected = 0;
    for (const correction of memberNames.members) {
      const member = state.collections.members[correction.id];
      // Match both identity and Chinese name; preserve custom signatures and removed members.
      if (!member || member.title !== correction.title || member.englishName !== correction.previousEnglishName) continue;
      member.englishName = correction.englishName;
      member.revision = (member.revision || 0) + 1;
      member.updatedAt = at;
      corrected++;
    }
    state.appliedContentImports.push(memberNames.id);
    if (corrected) state.history.push({ id: memberNames.id, action: 'import', collection: 'members', title: `修正成员英文姓名（${corrected} 项）`, user: '网站内容升级', at });
  }
  state.version += 1;
  state.history = state.history.slice(-200);
  return { state, changed: true };
}
