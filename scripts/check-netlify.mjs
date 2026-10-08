import { zipFunctions } from '@netlify/zip-it-and-ship-it';
const result = await zipFunctions('netlify/functions', '.netlify/bundled', { config: { '*': { nodeBundler: 'esbuild' } } });
for (const fn of result) {
  if (fn.runtimeAPIVersion !== 2) throw new Error(`${fn.name} 未识别为 Netlify Request/Response 函数`);
  console.log(`${fn.name}: API v${fn.runtimeAPIVersion} · ${fn.size} bytes`);
}
if (result.length !== 2) throw new Error('Netlify 函数数量异常');
