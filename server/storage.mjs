import { getStore } from '@netlify/blobs';
import seed from '../content/seed.json' with { type: 'json' };
import { HttpError } from './content.mjs';
import { applyContentImports } from './imports.mjs';

const freshSeed = () => structuredClone(seed);
export class BlobStorage {
  constructor(stores = {}) {
    this.content = stores.content || getStore({ name: 'imed-content-v1', consistency: 'strong' });
    this.media = stores.media || getStore({ name: 'imed-media-v1', consistency: 'strong' });
  }
  async read() {
    for (let attempt = 0; attempt < 5; attempt++) {
      const entry = await this.content.getWithMetadata('state', { type: 'json' });
      if (!entry) return { state: applyContentImports(freshSeed()).state, etag: null };
      const { state, changed } = applyContentImports(entry.data);
      if (!changed) return { state, etag: entry.etag };
      const saved = await this.content.setJSON('state', state, { onlyIfMatch: entry.etag });
      if (saved.modified && saved.etag) return { state, etag: saved.etag };
      // A concurrent admin save wins. Re-read it and apply only missing records.
    }
    throw new HttpError(409, '内容正在更新，请稍后重新加载');
  }
  async write(state, etag) {
    const result = await this.content.setJSON('state', state, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (!result.modified) throw new HttpError(409, '其他管理员刚刚修改了内容，请重新加载后再保存');
  }
  async putMedia(id, bytes, metadata) { await this.media.set(id, bytes, { metadata, onlyIfNew: true }); }
  async getMedia(id) { return this.media.getWithMetadata(id, { type: 'arrayBuffer' }); }
}

export async function createLocalStorage(filename) {
  const { DatabaseSync } = await import('node:sqlite');
  const { mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL, version INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, value BLOB NOT NULL, metadata TEXT NOT NULL)');
  db.prepare('INSERT OR IGNORE INTO content (id,value,version) VALUES (1,?,1)').run(JSON.stringify(seed));
  return {
    async read() {
      for (let attempt = 0; attempt < 5; attempt++) {
        const row = db.prepare('SELECT value,version FROM content WHERE id=1').get();
        const { state, changed } = applyContentImports(JSON.parse(row.value));
        if (!changed) return { state, etag: String(row.version) };
        const saved = db.prepare('UPDATE content SET value=?,version=version+1 WHERE id=1 AND version=?').run(JSON.stringify(state), row.version);
        if (saved.changes === 1) return { state, etag: String(row.version + 1) };
      }
      throw new HttpError(409, '内容正在更新，请稍后重新加载');
    },
    async write(state, etag) {
      const result = db.prepare('UPDATE content SET value=?,version=version+1 WHERE id=1 AND version=?').run(JSON.stringify(state), Number(etag));
      if (result.changes !== 1) throw new HttpError(409, '其他管理员刚刚修改了内容，请重新加载后再保存');
    },
    async putMedia(id, bytes, metadata) { db.prepare('INSERT INTO media (id,value,metadata) VALUES (?,?,?)').run(id, new Uint8Array(bytes), JSON.stringify(metadata)); },
    async getMedia(id) { const row = db.prepare('SELECT value,metadata FROM media WHERE id=?').get(id); return row ? { data: row.value, metadata: JSON.parse(row.metadata) } : null; },
    close() { db.close(); },
  };
}
