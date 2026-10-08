# 内容管理 API

同源访问，所有 JSON 响应使用 UTF-8，默认禁止缓存。错误响应为 `{ "error": "说明", "requestId": "请求标识" }`。前台 HTML 同样由后端实时读取已发布内容并生成，不通过旧根目录静态 HTML 回退。

## 登录

- `GET /api/auth/config`：返回 `mode`（local/identity）和 `configured`。
- 本地：`POST /api/auth/login`，JSON 包含 `username`、`password`，成功设置 HttpOnly、SameSite=Strict 会话 Cookie，有效期 8 小时，HTTPS 下带 Secure。
- 线上：浏览器通过 `/.netlify/identity/token` 取得令牌，请求体是 URL 编码表单：`grant_type=password&username=邮箱&password=密码`；刷新使用 `grant_type=refresh_token&refresh_token=...`。
- 线上管理 API 使用 `Authorization: Bearer <access_token>`，服务端向受信任的 Identity `/user` 端点验证。`app_metadata.roles` 需包含 admin/editor，或邮箱在 IMED_ADMIN_EMAILS 中。用户自行填写的角色信息不会用于授权。
- `GET /api/auth/me`：返回当前管理用户。
- `POST /api/auth/logout`：清除本地会话 Cookie；线上后台同时调用 Identity logout 来撤销刷新会话。
- 本地所有写请求必须携带与本站匹配的 Origin。线上令牌请求也拒绝不匹配的 Origin；不携带 Origin 的授权 API 客户端可以使用 Bearer 令牌。

## 公开接口

| 请求 | 行为 |
| --- | --- |
| GET /api/health | 检查服务与内容存储可读性 |
| GET /api/search?q=关键词 | 当前已发布内容搜索，返回 total、items，最多 40 条 |
| GET /api/content/:collection | 指定栏目已发布内容摘要 |
| GET /api/content/:collection/:id | 已发布内容详情，草稿或不存在返回 404 |
| GET /api/media/:id | 图片原始字节；稳定 UUID 地址，允许长期缓存 |

collection 为 news、members、publications、resources、pages。

## 管理接口

| 请求 | 行为 |
| --- | --- |
| GET /api/admin/dashboard | 栏目统计、最近操作和图片元信息 |
| GET /api/admin/:collection?q=&status=&page=1&limit=20 | 所有状态的管理列表；每页最多 100 条 |
| GET /api/admin/:collection/:id | 获取可编辑内容，响应 ETag 表示当前修订号 |
| POST /api/admin/:collection | 创建内容；返回 201 和 item |
| PUT /api/admin/:collection/:id | 更新完整内容，必须带 If-Match，例如 `"1"` |
| DELETE /api/admin/:collection/:id | 删除，必须带当前 If-Match |
| POST /api/admin/media | 上传图片原始二进制字节；X-File-Name 为 URL 编码文件名；最多 4 MB |
| GET /api/admin/export | 下载完整内容 JSON，包含图片元信息，不包含图片字节 |

修改不是 PATCH：PUT 应提交全部可编辑字段。后台会发送获取到的完整字段集合。未知字段不会写入记录；ID、修订号、创建时间、文章 URL、已有页面 slug 由服务端维护。

所有栏目通用字段：title（必填，最多 500 字符）、status（draft/published，创建时默认 draft）。

| 栏目 | 字段 |
| --- | --- |
| news | date（YYYY-MM-DD）、category（论文发表/学术活动/团队活动）、summary、bodyHtml、sourceUrl |
| members | category（研究人员/在读学生/客聘专家/毕业校友）、englishName、role、image、link、order |
| publications | journal、year、description、link、order |
| resources | subtitle、description、availability、link、order |
| pages | slug（新建时必填，例如 cooperation.html）、description、bodyHtml |

正文保存前进行 HTML 白名单清理，移除脚本、事件属性、危险协议、iframe、样式注入等。允许基本图文、表格及现有页面结构。链接字段仅接受合法站内地址或受支持协议；上传只接受 PNG/JPEG/GIF/WebP，不允许 SVG。

发布状态决定列表、首页、详情与搜索的可见性。撤下已发布内容时不会保留旧公开版本。文章详情地址为 `article.html?id=ID`；导入文章保留 `view-数字.html` 地址。

## 并发与错误

每项内容维护 revision。更新／删除请求必须匹配该修订号；数据库写入还检查整个内容状态的存储版本。即使不同管理员同时编辑不同项目，也可能收到需要刷新重试的冲突提示，不会静默覆盖。

- 400：字段、日期或链接不合法
- 401：未登录、过期或登录凭据不正确
- 403：权限不足或跨站来源不匹配
- 404：内容不存在或未公开
- 409：编辑或存储版本冲突
- 413：请求／文件过大
- 415：内容类型不支持
- 428：修改时缺少 If-Match
- 429：本地登录尝试过多
- 503：登录服务未配置或暂时不可用

审计记录只保存操作者、时间、动作和目标内容标题／ID，保留最近 200 条。后台令牌验证由 Identity 负责，应用不会存储线上用户密码。
