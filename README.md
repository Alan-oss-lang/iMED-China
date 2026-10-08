# iMED China 网站与内容管理后台

科研团队网站，沿用现有深蓝与青绿色页面设计。本次补齐了与前台对应的内容管理后端；未加入留言、报名或数据申请等新业务。

## 本地运行

安装 **Node.js 24 LTS**（最低 22.13），在项目根目录运行：

~~~powershell
npm install
npm run setup
npm run dev
~~~

setup 会询问管理员用户名、生成随机密码并显示一次。请保存密码；账号配置写入 .env.local，不会提交到仓库。已有配置不会被覆盖。不要将 .env.local 上传或共享。

- 前台：http://127.0.0.1:8765/
- 管理后台：http://127.0.0.1:8765/admin/
- 本地内容和上传图片保存在 var/imed.sqlite；重启后保留。

默认只监听本机。端口可在 .env.local 中通过 PORT 修改。也可用 pnpm 安装依赖；仓库提供 pnpm-lock.yaml。

根目录原始 HTML 保留作为归档与离线参考；**当前后端网站必须通过 npm run dev 运行**。直接打开旧 HTML 或使用 Python 静态服务器，不能验证后台编辑发布。部署时发布 dist，不发布整个仓库根目录。

## 已补齐的功能

| 管理栏目 | 可维护内容 | 前台同步位置 |
| --- | --- | --- |
| 新闻与活动 | 标题、分类、日期、摘要、正文、来源 | 首页、新闻、分享会、团队风采、详情、搜索 |
| 团队成员 | 姓名、英文名、成员分组、职务、照片、个人介绍、顺序 | 成员列表与搜索 |
| 科研成果 | 标题、期刊、年份、说明、详情链接、顺序 | 成果页、首页代表成果、搜索 |
| 数据资源 | 名称、用途、说明、开放状态、链接、顺序 | 资源页、首页资源入口、搜索 |
| 页面内容 | 首页、研究方向、介绍、招募、联系、英文介绍、历史资料；支持新建页面 | 对应页面与搜索 |

支持新增、编辑、删除、草稿／发布状态、正文可视编辑、图片上传、正文预览、管理列表分页、操作记录和内容 JSON 备份。前台保持分类／年份／关键词筛选、分页、移动导航和返回顶部。

现有资料已导入 content/seed.json：359 条动态、104 位成员、7 条代表性成果、6 项资源、77 个介绍与历史资料页面。资料仍以原始公开归档为依据；成员资料不保证实时状态。历史招募、SURE 下载待开放、ORIGA-650 停止下载等说明予以保留。

首页新闻、特色动态、代表成果和资源入口自动使用已发布内容。编辑首页中的文字、图片与版式时，保留“自动内容区”即可持续同步。页面内容编辑器维护的是正文；全站导航和页脚属于统一模板。

**保存为草稿会撤下已经发布的内容。** 删除或撤下后，对应旧文章地址返回 HTTP 404，页面源代码也不再包含原正文。管理后台同时修改同一内容时，后提交者会收到冲突提示，需重新打开内容后编辑。首页不可删除或撤下。

公开页面同时支持带 .html 和不带扩展名的链接，例如 /news.html 与 /news。以斜杠结尾的页面链接会跳转到对应根目录页面，避免图片、样式和导航的相对地址失效。

上传支持 PNG、JPEG、GIF、WebP，单张最多 4 MB；服务端检查文件类型。研究数据仍通过原始资源链接提供，不通过图片上传功能上传数据集。

## 部署到现有 Netlify 站点

当前站点：
- 前台：https://sparkling-souffle-073162.netlify.app/
- 后台：https://sparkling-souffle-073162.netlify.app/admin/

代码推送到已关联仓库会触发 Netlify 构建。是否发布成功，以部署日志与线上健康接口为准。

1. 将更新后的项目文件同步到 Netlify 已关联的 GitHub 仓库根目录，包括 package.json、pnpm-lock.yaml、pnpm-workspace.yaml、netlify.toml、server/、content/、netlify/、scripts/、admin/、assets/。不要上传 node_modules、var 或 .env.local。
2. Netlify 构建命令为 **npm run build**，发布目录为 **dist**，函数目录为 **build-functions**；netlify.toml 已配置，构建 Node 版本为 24。构建会先打包 netlify/functions 中的函数源码和依赖，避免运行环境的 CommonJS／ESM 兼容差异。
3. 保持现有 Netlify Identity 开启，建议继续使用“仅邀请”注册。现有账号可以继续使用。
4. 在 Netlify 为至少一个 Identity 账号设置 **admin** 或 **editor** 角色；也可以在 Netlify 环境变量中设置 IMED_ADMIN_EMAILS 为允许维护内容的邮箱，多个邮箱用逗号分隔。变量需包含 Functions 作用范围，更改后重新部署。只有登录并通过权限校验的账号能编辑内容。
5. 建议将 IMED_IDENTITY_URL 设为 https://sparkling-souffle-073162.netlify.app（Functions 作用范围），尤其使用预览部署或自定义域名时。未设置时使用 Netlify 的 URL 环境变量。
6. 正常 Git 构建部署后，检查 /api/health，再登录 /admin/ 编辑一条测试草稿，发布并确认前台显示，最后删除测试内容。

线上内容和图片分别持久化到 Netlify Blobs 的 imed-content-v1 与 imed-media-v1 命名存储中。它们与部署目录分离，正常重新部署不会清空编辑后的内容；需要所用 Netlify 站点／套餐允许 Functions 和 Blobs。无需额外购买或配置独立数据库服务器。首次读取使用 seed 内容，第一次修改后保存完整内容状态。

旧 Decap CMS 已由与前台直接联动的管理应用替换。admin/config.yml 仅保留作旧配置参考，不会部署；新后台不再依赖 Git Gateway。**不能仅拖拽 dist 做静态上传**，必须同时部署后端函数。GitHub Pages 只能展示旧归档静态页面，不能运行这套后端。

Identity 邀请和密码重置链接可从首页自动转入管理后台。登录、邀请激活与重置使用 Netlify Identity 原有服务；本地测试账号与线上账号独立。

## 存储、备份与维护

- 本地：SQLite 原子更新；停止服务后复制整个 var 目录，可备份内容与上传图片。SQLite 的 WAL 文件也位于该目录。
- 线上：Netlify Blobs 使用强一致性读取与条件写入，避免多位管理员互相覆盖。
- 管理后台“下载内容备份”导出当前内容、图片元信息和最近 200 条操作记录。**JSON 不包含图片文件本身**；线上上传图片需另行从媒体存储备份。当前没有一键恢复界面。
- .env.local 含本地密码散列与会话密钥；更换会话密钥会使已有本地登录失效。
- 线上账号权限与停用由 Identity 管理；服务器每次验证登录状态，已验证账号信息最多缓存 15 秒。
- content/seed.json 是初始化数据；后端保存后的数据库／Blobs 数据是实际内容来源。不要通过编辑旧根目录 HTML 来维护线上内容，也不要在每次构建时重新导入归档。

原 build.py 与 _build_site.py 保留用于从原始归档重新生成旧静态页面，依赖 Python、BeautifulSoup4、Pillow 和归档目录。随后可手动运行 npm run import:legacy 更新 seed 与模板。该命令会重写 content/seed.json 与 content/templates.json，**不会更新已有本地数据库或线上 Blobs**。常规维护不需要运行归档生成工具。

## 接口与结构

公开接口只返回已发布内容；管理接口需登录。参见 docs/API.md。

| 路径 | 用途 |
| --- | --- |
| server/app.mjs | REST 接口、权限、输入校验、操作记录 |
| server/auth.mjs | 本地会话与 Netlify Identity 验证 |
| server/storage.mjs | SQLite／Netlify Blobs 持久化与并发检查 |
| server/render.mjs | 前台服务端渲染、历史链接与搜索 |
| server/content.mjs | 内容模型、HTML 清理与链接校验 |
| server/local.mjs | 本地开发服务器，限制文件公开范围 |
| netlify/functions/ | 线上 API 与页面函数 |
| admin/ | 中文管理界面与正文编辑器 |
| content/ | 初始内容与服务器页面模板 |
| scripts/build.mjs | 仅构建公开资源，避免静态 HTML 绕过发布状态 |
| scripts/import-legacy.mjs | 一次性归档导入工具 |
| tests/ | 接口、安全、持久化与浏览器业务验证 |

## 验证

~~~powershell
npm test
npm run build
npm run check:netlify
npx playwright install chromium
npm run test:browser
~~~

浏览器测试使用独立临时数据库，不会修改日常内容或线上站点。Windows 已安装 Edge 时可跳过浏览器下载：

~~~powershell
$env:IMED_BROWSER_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm run test:browser
~~~

目前验证覆盖迁移数据、全部已管理页面、登录权限、草稿发布撤下删除、当前内容搜索、输入清理、图片上传、重启持久化、并发冲突、浏览器编辑流程、移动布局、Identity 请求格式与 Netlify 函数打包。线上真实账号登录和 Blobs 读写仍需部署后验证。
