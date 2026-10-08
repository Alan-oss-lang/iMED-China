import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../server/auth.mjs';

const rl = createInterface({ input: process.stdin, output: process.stdout });
try {
  const username = (await rl.question('本地管理员用户名（默认 admin）：')).trim() || 'admin';
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(username)) throw new Error('用户名应为 1–64 位英文字母、数字、下划线或点');
  const password = randomBytes(18).toString('base64url');
  const config = `IMED_ADMIN_USERNAME=${username}\nIMED_ADMIN_PASSWORD_HASH=${hashPassword(password)}\nIMED_SESSION_SECRET=${randomBytes(48).toString('hex')}\nHOST=127.0.0.1\nPORT=8765\n`;
  await writeFile(new URL('../.env.local', import.meta.url), config, { flag: 'wx', mode: 0o600 });
  console.log(`已创建 .env.local（不会提交到仓库）。\n用户名：${username}\n随机密码：${password}\n请保存密码，然后运行 npm run dev。`);
} catch (error) {
  console.error(error.code === 'EEXIST' ? '.env.local 已存在，未覆盖原账号。要重置账号，请先备份并移走该文件，再重新运行 setup。' : error.message);
  process.exitCode = 1;
} finally { rl.close(); }
