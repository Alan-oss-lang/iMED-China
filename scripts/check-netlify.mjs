import { zipFunctions } from '@netlify/zip-it-and-ship-it';
import { spawnSync } from 'node:child_process';
const check = spawnSync(process.execPath, ['--no-experimental-require-module', '--input-type=module', '-e', "await import('./build-functions/api.mjs'); await import('./build-functions/site.mjs');"], { encoding: 'utf8', windowsHide: true });
if (check.status !== 0) throw new Error(`Lambda 模块兼容性检查失败：${check.stderr || check.error?.message}`);
const result = await zipFunctions('build-functions', '.netlify/bundled', { config: { '*': { nodeBundler: 'esbuild' } } });
for (const fn of result) {
  if (fn.runtimeAPIVersion !== 2) throw new Error(`${fn.name} 未识别为 Netlify Request/Response 函数`);
  console.log(`${fn.name}: API v${fn.runtimeAPIVersion} · ${fn.size} bytes`);
}
if (result.length !== 2) throw new Error('Netlify 函数数量异常');
