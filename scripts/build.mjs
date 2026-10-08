import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import seed from '../content/seed.json' with { type: 'json' };

const root = fileURLToPath(new URL('../', import.meta.url)), dist = resolve(root, 'dist');
if (dirname(dist) !== resolve(root) || dist === root) throw new Error('构建输出路径无效');
for (const file of ['admin/index.html', 'assets/app.js', 'content/templates.json']) await stat(resolve(root, file));
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(resolve(root, 'assets'), resolve(dist, 'assets'), { recursive: true, filter: path => !['source-map.json', 'search-index.js'].includes(path.split(/[\\/]/).at(-1)) });
await cp(resolve(root, 'admin'), resolve(dist, 'admin'), { recursive: true, filter: path => !path.endsWith('config.yml') });
// HTML is rendered by the backend. Publishing archived HTML here would bypass draft/deletion checks.
console.log(`构建完成：静态资源与管理后台 → dist；${Object.keys(seed.collections.news).length} 条初始动态由后端渲染。`);
