# iMED China 网站

基于 iMED 公开官网 2026-10-05 归档及 `Alan-oss-lang/iMED-China` 现有仓库制作的中文科研网站。深蓝与青绿色视觉，兼顾桌面与移动屏幕。

## 查看效果

直接打开 `index.html` 即可浏览。搜索、筛选与分页不需要服务器或数据库。也可以在此文件夹运行：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:8765`。

## 上传到你已配置的 GitHub 仓库

目标仓库：https://github.com/Alan-oss-lang/iMED-China

1. 将 **code 文件夹内的内容** 放入仓库根目录。仓库根目录应直接出现 `index.html`、`assets/`、`admin/` 等文件，而不是再套一层 `code/`。
2. 更新 `main` 分支后，在 GitHub 的 **Settings → Pages** 核对现有发布来源。若使用分支发布，选择 `main` 与 `/(root)`。
3. 等待 Pages 部署完成，访问 https://alan-oss-lang.github.io/iMED-China/ 。此地址是预期发布地址，本次未执行远程上传或部署。
4. 若现有 Pages 使用你自己的 GitHub Actions 工作流，继续使用原工作流，并让其发布仓库根目录；本项目无需 npm 安装或构建命令。

所有内部资源采用相对路径，适用于 GitHub Pages 的 `/iMED-China/` 子路径。`.nojekyll` 已包含。

## 已实现

- 首页、团队、研究方向、科研成果、新闻、数据与代码、招募、联系、英文介绍。
- 359 条新闻与学术动态；团队资料包含 104 张成员卡片，按研究人员、在读学生、客聘专家、毕业校友分组。
- 全站搜索、年份与关键词筛选、分页、移动导航、键盘可访问搜索弹窗、返回顶部。
- 归档正文、图像与已有下载入口；图片转为本地 WebP，公共页面不依赖外部字体、CDN 或前端框架。
- 历史链接别名、缺失文章提示、数据集可用状态与历史招募日期提示。

## 现有后台

`admin/index.html` 与 `admin/config.yml` 从你现有仓库原样保留。

该后台使用 **Decap CMS + Netlify Identity + git-gateway**。静态前台可单独运行于 GitHub Pages；后台登录和提交内容仍依赖你配置的 Netlify Identity/Git Gateway 服务。当前无法从公开仓库确认这些服务已启用，因此没有宣称后台登录已验证。

当前后台配置的 HTML 首页字段及 `news/` 内容不会自动接入本次归档生成流程。它是保留的既有入口，尚未完成 CMS 编辑发布集成；需要使用后台维护内容时，应单独配置内容模型和发布流程，避免直接编辑布局 HTML。

## 文件说明

| 文件 | 用途 |
| --- | --- |
| `index.html` | 网站首页 |
| `team.html`、`news.html` 等 | 栏目页面 |
| `view-*.html` | 归档原文详情 |
| `assets/styles.css` | 全站样式、响应式规则 |
| `assets/app.js` | 搜索、菜单、筛选、分页 |
| `assets/search-index.js` | 全站本地搜索索引 |
| `assets/media/` | 经过优化的本地图片 |
| `assets/source-map.json` | 资源来源记录 |
| `build.py`、`_build_site.py` | 可选的本地生成工具 |
| `DESIGN-NOTES.md` | 设计调研与取舍 |

## 可选：从归档重新生成

部署现成 HTML **不需要** Python。仅重新导入归档时需要 Python 3.10+、BeautifulSoup4 与 Pillow（先检查是否已安装）。在 `code` 文件夹运行：

```powershell
python build.py --archive ../website-archive-2026-10-05
```

归档必须与当前目录处于同级。生成操作只写入本目录，不修改归档、不上传远程仓库。生成工具会覆盖已有页面，因此长期维护时应修改生成模板或原始内容数据，而不是只改生成后的 HTML。

## 内容边界

资料以归档内容为依据，并链接原始来源。最新消息截至 2026-09-03；历史成员资料不代表当前实时状态。2026 年论文依据录用公告表述，未虚构正式发表信息。2020 年招募公告明确标为历史资料。SURE 标记下载待开放，ORIGA-650 标记停止公开下载。

这次制作未修改或发布远程仓库，未更改原始归档。原站内容和影像资料的权利归其原权利人所有。
