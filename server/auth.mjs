import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { HttpError } from './content.mjs';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function checkPassword(password, hash) {
  const [salt, expected] = String(hash || '').split(':');
  if (!salt || !/^[a-f0-9]{128}$/.test(expected || '')) return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
export function createLocalAuth(env = process.env) {
  const secret = env.IMED_SESSION_SECRET;
  const configured = Boolean(secret?.length >= 32 && env.IMED_ADMIN_USERNAME && env.IMED_ADMIN_PASSWORD_HASH);
  const attempts = new Map();
  const signature = value => createHmac('sha256', secret).update(value).digest('base64url');
  return {
    mode: 'local', configured,
    async login(input, address = 'local') {
      if (!configured) throw new HttpError(503, '请先在项目目录运行 npm run setup，创建本地管理员');
      const now = Date.now(), attempt = attempts.get(address);
      if (attempt?.until > now && attempt.count >= 5) throw new HttpError(429, '尝试次数过多，请在 15 分钟后重试');
      if (attempts.size > 1000) for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
      if (typeof input?.username !== 'string' || typeof input?.password !== 'string' || input.password.length > 200 || input.username !== env.IMED_ADMIN_USERNAME || !checkPassword(input.password, env.IMED_ADMIN_PASSWORD_HASH)) {
        attempts.set(address, { count: attempt?.until > now ? attempt.count + 1 : 1, until: now + 900000 });
        throw new HttpError(401, '用户名或密码错误');
      }
      attempts.delete(address);
      const payload = Buffer.from(JSON.stringify({ sub: env.IMED_ADMIN_USERNAME, exp: Math.floor(now / 1000) + 28800 })).toString('base64url');
      return { token: `${payload}.${signature(payload)}`, user: { id: env.IMED_ADMIN_USERNAME, name: env.IMED_ADMIN_USERNAME, roles: ['admin'] } };
    },
    async user(request) {
      if (!configured) throw new HttpError(503, '本地管理员尚未配置');
      const token = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('imed_session='))?.slice(13);
      if (!token || token.length > 2000) throw new HttpError(401, '请先登录管理后台');
      const parts = token.split('.');
      if (parts.length !== 2) throw new HttpError(401, '登录已失效，请重新登录');
      const expected = signature(parts[0]), actual = parts[1];
      if (expected.length !== actual.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new HttpError(401, '登录已失效，请重新登录');
      let user; try { user = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); } catch { throw new HttpError(401, '登录已失效，请重新登录'); }
      if (user.sub !== env.IMED_ADMIN_USERNAME || !Number.isFinite(user.exp) || user.exp <= Date.now() / 1000) throw new HttpError(401, '登录已失效，请重新登录');
      return { id: user.sub, name: user.sub, roles: ['admin'] };
    },
  };
}
export function createIdentityAuth(env = process.env, fetcher = fetch) {
  const identityOrigin = env.IMED_IDENTITY_URL || env.URL;
  const endpoint = identityOrigin ? new URL('/.netlify/identity/user', identityOrigin) : null;
  const allowlist = (env.IMED_ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  const cache = new Map();
  return {
    mode: 'identity', configured: Boolean(endpoint && endpoint.protocol === 'https:'),
    async user(request) {
      if (!endpoint || endpoint.protocol !== 'https:') throw new HttpError(503, 'Netlify 登录服务地址尚未配置');
      const token = request.headers.get('authorization');
      if (!token?.startsWith('Bearer ') || token.length > 10000) throw new HttpError(401, '请先登录管理后台');
      // Identity verifies signatures, expiration and account status; never trust decoded JWT claims.
      const cached = cache.get(token);
      if (cached && cached.until > Date.now()) return cached.user;
      let response;
      try { response = await fetcher(endpoint, { headers: { Authorization: token }, signal: AbortSignal.timeout(8000), redirect: 'error' }); } catch { throw new HttpError(503, '登录服务暂时不可用，请稍后重试'); }
      if ([401, 403].includes(response.status)) throw new HttpError(401, '登录已失效，请重新登录');
      if (!response.ok) throw new HttpError(503, '登录服务暂时不可用，请稍后重试');
      let identity; try { identity = await response.json(); } catch { throw new HttpError(503, '登录服务返回无效响应'); }
      const roles = Array.isArray(identity.app_metadata?.roles) ? identity.app_metadata.roles : [];
      if (!identity.id || !identity.email || (!roles.some(r => ['admin', 'editor'].includes(r)) && !allowlist.includes(identity.email.toLowerCase()))) throw new HttpError(403, '账号没有内容管理权限，请为账号配置 admin/editor 角色或管理员邮箱白名单');
      const user = { id: identity.id, name: identity.user_metadata?.full_name || identity.email, roles };
      if (cache.size >= 200) cache.clear();
      cache.set(token, { user, until: Date.now() + 15000 });
      return user;
    },
  };
}
export function verifyOrigin(request, { required = false } = {}) {
  const origin = request.headers.get('origin');
  if ((required && !origin) || origin && origin !== new URL(request.url).origin) throw new HttpError(403, '请求来源不匹配，请从本站管理后台操作');
}
