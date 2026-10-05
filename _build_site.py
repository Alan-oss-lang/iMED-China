from pathlib import Path
from html import escape
import json

OUT = Path(__file__).parent
ASSET = 'assets/'

NAV = [
    ('首页', 'index.html', 'home'), ('团队', 'team.html', 'team'),
    ('研究方向', 'research.html', 'research'), ('科研成果', 'publications.html', 'publications'),
    ('新闻动态', 'news.html', 'news'), ('数据资源', 'datasets.html', 'datasets'),
    ('加入我们', 'recruitment.html', 'recruitment'),
]

SEARCH = [
    {'title':'团队介绍', 'category':'团队', 'url':'about.html', 'text':'iMED中国智能医学影像团队以精准医疗为核心，开展医学影像分析、眼脑联合计算和临床转化研究。'},
    {'title':'赵一天｜团队负责人', 'category':'团队成员', 'url':'team.html', 'text':'研究员 PI，医学影像分析与眼科影像，研究团队负责人。'},
    {'title':'医学影像分析', 'category':'研究方向', 'url':'research.html#analysis', 'text':'医学图像分割、检测、配准与智能诊断。'},
    {'title':'眼科智能诊疗', 'category':'研究方向', 'url':'research.html#ophthalmology', 'text':'眼底、OCT/OCTA影像分析与眼脑联合计算。'},
    {'title':'可信医学人工智能', 'category':'研究方向', 'url':'research.html#trustworthy', 'text':'不确定性估计、跨域泛化、数据效率和临床可靠性。'},
    {'title':'手术导航与机器人', 'category':'研究方向', 'url':'research.html#navigation', 'text':'面向介入与手术规划的影像导航和智能机器人。'},
    {'title':'Two papers have been accepted by IOVS and JAHA', 'category':'论文发表', 'url':'article.html?id=vascular-metrics', 'date':'2026-09-03', 'text':'Retinal and Choroidal Vascular Metrics Predict Cerebral Atrophy and Cognitive Impairment in Noninfarcted Large Artery Stenosis'},
    {'title':'Consistency-guided Uncertainty Estimation for Source-Free Medical Image Segmentation', 'category':'论文发表', 'url':'article.html?id=uncertainty', 'date':'2026-08-28', 'text':'IEEE Trans Image Process (TIP)'},
    {'title':'A Frequency-aware Dual-domain Collaborative Framework for Medical Image Enhancement', 'category':'论文发表', 'url':'article.html?id=enhancement', 'date':'2026-08-21', 'text':'Medical Image Analysis'},
    {'title':'Nine MICCAI Papers have been accepted this year', 'category':'新闻动态', 'url':'article.html?id=miccai', 'date':'2026-06-13', 'text':'团队九篇 MICCAI 论文录用，持续推进智能医学影像研究。'},
    {'title':'无造影剂微血管阻塞识别：动态心脏磁共振中的机遇与挑战', 'category':'学术活动', 'url':'article.html?id=cmr', 'date':'2026-07-30', 'text':'iMED中国第七十三讲学术分享会，程骏教授专题报告。'},
    {'title':'青春作伴，十载同行——iMED十周年暨第九届iMED杯羽毛球赛', 'category':'团队活动', 'url':'article.html?id=anniversary', 'date':'2026-06-15', 'text':'团队十周年毕业季活动，记录iMED人的科研与生活。'},
    {'title':'ROSE｜Retinal OCT-Angiography Vessel Segmentation Dataset', 'category':'数据资源', 'url':'datasets.html#rose', 'text':'开放的视网膜OCT血管分割数据集，包含ROSE-1与ROSE-2子集。'},
    {'title':'CORN｜Corneal Nerve Database', 'category':'数据资源', 'url':'datasets.html#corn', 'text':'角膜神经纤维数据集，面向学术研究开放。'},
    {'title':'COSTA｜TOF-MRA脑血管分割数据库', 'category':'数据资源', 'url':'datasets.html#costa', 'text':'多中心、多厂商TOF-MRA脑血管分割数据库。'},
]

NEWS = [
    ('2026-09-03','论文发表','Two papers have been accepted by IOVS and JAHA','article.html?id=vascular-metrics','retina'),
    ('2026-08-28','论文发表','One paper has been accepted by IEEE Trans Image Process (TIP)','article.html?id=uncertainty','research'),
    ('2026-08-21','论文发表','One paper has been accepted by Medical Image Analysis','article.html?id=enhancement','research'),
    ('2026-07-30','学术活动','高可信心血管磁共振智能分析专题讲座：无造影剂微血管阻塞识别','article.html?id=cmr','event'),
    ('2026-06-15','团队活动','青春作伴，十载同行——iMED十周年暨第九届“iMED杯”羽毛球赛圆满举行','article.html?id=anniversary','team'),
    ('2026-06-13','论文发表','Nine MICCAI Papers have been accepted this year','article.html?id=miccai','research'),
    ('2026-05-25','论文发表','One paper has been accepted by IEEE Trans Med. Imaging (TMI)','article.html?id=causal','research'),
    ('2026-05-15','团队新闻','智能医学影像团队硕士研究生毕业答辩顺利举行','article.html?id=graduation','team'),
]

def icon(name):
    icons = {
        'search':'<svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>',
        'menu':'<svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
        'arrow':'<span class="arrow">→</span>',
        'people':'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M14 15c3.5-.4 5.7 1.2 6 5"/></svg>',
        'microscope':'<svg viewBox="0 0 24 24"><path d="M8 3h4M10 3v6l-3 4a4 4 0 0 0 3 6h9M5 21h15M14 10h5M15 5l4 5"/></svg>',
        'news':'<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"/></svg>',
        'database':'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></svg>',
        'mail':'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m4 7 8 6 8-6"/></svg>',
        'close':'<svg viewBox="0 0 24 24"><path d="m5 5 14 14M19 5 5 19"/></svg>',
    }
    return icons[name]

def head(title, active=''):
    links = ''.join(f'<a href="{href}" class="{("active" if active == key else "")}">{label}</a>' for label,href,key in NAV)
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#102f4f"><meta name="description" content="iMED中国智能医学影像团队官方网站"><link rel="icon" href="{ASSET}favicon.svg"><link rel="stylesheet" href="{ASSET}styles.css"><title>{escape(title)}｜iMED中国</title></head>
<body data-base="">
<a class="skip" href="#main">跳转到主要内容</a>
<div class="topbar"><div class="container"><span>中国科学院宁波材料技术与工程研究所 · 智能医学影像团队</span><div class="toplinks"><a href="https://www.nimte.ac.cn/" target="_blank" rel="noreferrer">宁波材料所</a><a href="https://imed.nimte.ac.cn/aboutus.html" target="_blank" rel="noreferrer">English</a><a href="contact.html">联系我们</a></div></div></div>
<header class="site-header"><div class="container header-row"><a class="brand" href="index.html" aria-label="iMED中国首页"><span class="wordmark">i<i>MED</i></span><span class="brand-copy"><strong>智能医学影像团队</strong><small>INTELLIGENT MEDICAL IMAGING · NIMTE</small></span></a><nav class="nav" id="main-nav" aria-label="主导航">{links}</nav><div class="header-actions"><button class="icon-button" data-search-open aria-label="搜索">{icon('search')}</button><button class="icon-button menu-button" data-menu aria-expanded="false" aria-controls="main-nav" aria-label="打开导航">{icon('menu')}</button></div></div></header>
<dialog class="search-dialog" id="search-dialog"><div class="search-header"><h2>搜索 iMED</h2><button class="icon-button" data-search-close aria-label="关闭">{icon('close')}</button></div><label class="search-field">{icon('search')}<input id="site-search" type="search" placeholder="搜索研究、论文、数据集或成员" autocomplete="off"></label><p class="search-summary" id="search-summary">试试搜索：医学分割、MICCAI、ROSE、赵一天</p><div class="search-results" id="search-results"></div></dialog>
'''

def footer():
    return f'''<section class="join-banner"><div class="container"><div><h2>和我们一起，让影像看见更多</h2><p>欢迎关注医学影像分析、眼脑联合计算与临床转化的青年研究者加入 iMED。</p></div><a class="button" href="recruitment.html">查看招募信息 {icon('arrow')}</a></div></section>
<footer class="footer"><div class="container footer-grid"><div><a class="wordmark" href="index.html">i<i>MED</i></a><div class="footer-title">智能医学影像团队</div><p>Intelligent Medical Imaging China<br>中国科学院宁波材料技术与工程研究所</p></div><div><h3>快速导航</h3><div class="footer-links">{''.join(f'<a href="{h}">{l}</a>' for l,h,k in NAV[1:])}<a href="about.html">关于我们</a><a href="contact.html">联系方式</a></div></div><div><h3>联系我们</h3><p>浙江省宁波市慈溪市白沙路街道学林路99号<br>邮编：315300<br>邮箱：<a href="mailto:yuexingyu@nimte.ac.cn">yuexingyu@nimte.ac.cn</a></p></div></div><div class="container footer-bottom"><span>© 2026 iMED China · Intelligent Medical Imaging</span><span>中国科学院宁波材料所 · 医疗影像/眼科影像团队</span></div></footer><button class="backtop" data-backtop aria-label="返回顶部" hidden>↑</button><script>window.IMED_SEARCH={json.dumps(SEARCH,ensure_ascii=False)};</script><script src="{ASSET}app.js"></script></body></html>'''

def page(title, active, content):
    return head(title, active) + f'<main id="main">{content}</main>' + footer()

def banner(title, english, desc):
    return f'<section class="page-banner"><div class="container"><div class="breadcrumb"><a href="index.html">首页</a><span>/</span><span>{escape(title)}</span></div><h1>{escape(title)} <span class="english">{escape(english)}</span></h1><p>{escape(desc)}</p></div></section>'

def section_heading(eyebrow, title, more=''):
    more_html = f'<a class="text-link" href="{more}">查看更多 {icon("arrow")}</a>' if more else ''
    return f'<div class="section-heading"><div><div class="eyebrow">{escape(eyebrow)}</div><h2 class="section-title">{escape(title)}</h2></div>{more_html}</div>'

def img(name, alt=''):
    return f'<img src="{ASSET}media/{name}" alt="{escape(alt)}" loading="lazy">'

def date_parts(date):
    parts = date.split('-'); return parts[0], parts[1]+'·'+parts[2], parts[2]

def news_row(item, home=False):
    date, category, title, href, image_key = item
    year, md, day = date_parts(date)
    return f'<a class="news-row" data-item data-home-news data-category="{escape(category)}" data-year="{year}" href="{href}"><span class="news-date"><strong>{day}</strong><small>{year}.{md[:2]}</small></span><span><span class="tag">{escape(category)}</span><h3>{escape(title)}</h3></span>{icon("arrow")}</a>'

def write(name, content):
    (OUT/name).write_text(content, encoding='utf-8')

def home():
    news = ''.join(news_row(n, True) for n in NEWS)
    return page('首页','home', f'''<section class="hero"><div class="container hero-grid"><div><div class="eyebrow">INTELLIGENT MEDICAL IMAGING · NIMTE</div><h1>用智能影像<br><em>理解生命的细节</em></h1><p class="hero-desc">iMED中国聚焦医学影像分析、眼脑联合计算与临床智能诊疗，连接算法、数据和真实世界的医疗需求。</p><div class="hero-buttons"><a class="button" href="research.html">探索研究方向 {icon('arrow')}</a><a class="text-link" href="about.html">了解 iMED {icon('arrow')}</a></div></div><div class="hero-visual"><div class="orbit"></div><div class="orbit o2"></div><div class="orbit o3"></div><div class="science-label top">MULTI-MODAL · 01</div><div class="science-label bottom">CLINICAL AI · 2026</div><div class="retina-globe">{img('retina-analysis.png','视网膜血管分析图')}</div><div class="scan-card scan-a">{img('octa-segmentation.png','OCTA影像分割示例')}<span>OCTA / VESSEL MAP <b>01</b></span></div><div class="scan-card scan-b">{img('vessel-topology.png','血管拓扑估计示例')}<span>TOPOLOGY / 3D <b>02</b></span></div><span class="cross"></span></div></div><div class="container hero-bottom"><span><b>01</b>　精准医疗</span><span><b>02</b>　医工交叉</span><span><b>03</b>　开放协作</span></div></section><section class="quicklinks"><div class="container quick-grid"><a class="quick-item" href="team.html">{icon('people')}<span><strong>团队成员</strong><small>MEET OUR TEAM</small></span>{icon('arrow')}</a><a class="quick-item" href="research.html">{icon('microscope')}<span><strong>研究方向</strong><small>RESEARCH TOPICS</small></span>{icon('arrow')}</a><a class="quick-item" href="publications.html">{icon('news')}<span><strong>科研成果</strong><small>PUBLICATIONS</small></span>{icon('arrow')}</a><a class="quick-item" href="datasets.html">{icon('database')}<span><strong>开放数据</strong><small>DATASETS</small></span>{icon('arrow')}</a></div></section><section class="section"><div class="container">{section_heading('LATEST UPDATES','最新动态','news.html')}<div class="news-layout"><a class="feature-news" href="article.html?id=anniversary"><div class="feature-photo">{img('team-ten-years.jpg','iMED十周年团队合影')}<span class="image-label">团队风采 · 2026</span></div><div class="meta"><span>2026-06-15</span><span>TEAM STORY</span></div><h3>青春作伴，十载同行：iMED十周年暨第九届“iMED杯”羽毛球赛</h3><p>十载春秋，步履不停；青春作伴，未来可期。记录团队共同成长的珍贵时刻。</p></a><div><div class="news-tabs"><button data-home-category="全部" aria-pressed="true">全部</button><button data-home-category="论文发表" aria-pressed="false">论文发表</button><button data-home-category="学术活动" aria-pressed="false">学术活动</button></div>{news}</div></div></div></section><section class="section soft" id="research"><div class="container">{section_heading('RESEARCH FOCUS','研究方向','research.html')}<div class="research-grid"><a class="research-card" href="research.html#analysis"><div class="research-image">{img('multimodal-imaging.png','多模态医学影像')}<span class="num">01</span></div><div class="research-card-body"><h3>医学影像分析</h3><p>从分割、检测到拓扑估计，构建面向临床的可靠影像智能方法。</p><span class="text-link">了解方向 {icon('arrow')}</span></div></a><a class="research-card" href="research.html#ophthalmology"><div class="research-image">{img('retina-analysis.png','眼科影像分析')}<span class="num">02</span></div><div class="research-card-body"><h3>眼科智能诊疗</h3><p>围绕眼底、OCT/OCTA影像，探索眼病筛查与眼脑联合计算。</p><span class="text-link">了解方向 {icon('arrow')}</span></div></a><a class="research-card" href="research.html#trustworthy"><div class="research-image">{img('octa-segmentation.png','可信人工智能')}<span class="num">03</span></div><div class="research-card-body"><h3>可信医学 AI</h3><p>关注泛化、不确定性、数据效率与真实临床场景中的模型可靠性。</p><span class="text-link">了解方向 {icon('arrow')}</span></div></a><a class="research-card" href="research.html#navigation"><div class="research-image">{img('vessel-topology.png','影像导航与机器人')}<span class="num">04</span></div><div class="research-card-body"><h3>影像导航与机器人</h3><p>连接影像理解与介入操作，为精准治疗提供智能导航支持。</p><span class="text-link">了解方向 {icon('arrow')}</span></div></a></div></div></section><section class="section"><div class="container">{section_heading('SELECTED WORKS','代表性成果','publications.html')}<div class="pub-grid"><a class="pub-card" href="article.html?id=vascular-metrics"><span class="journal">IOVS · JAHA</span><h3>Retinal and Choroidal Vascular Metrics Predict Cerebral Atrophy and Cognitive Impairment</h3><div class="meta"><span>2026</span><span>RESEARCH ARTICLE</span></div></a><a class="pub-card" href="article.html?id=uncertainty"><span class="journal">IEEE TIP</span><h3>Consistency-guided Uncertainty Estimation for Source-Free Medical Image Segmentation</h3><div class="meta"><span>2026</span><span>METHOD</span></div></a><a class="pub-card" href="article.html?id=enhancement"><span class="journal">MEDICAL IMAGE ANALYSIS</span><h3>A Frequency-aware Dual-domain Collaborative Framework for Medical Image Enhancement</h3><div class="meta"><span>2026</span><span>METHOD</span></div></a></div></div></section><section class="section soft"><div class="container team-preview"><div class="team-preview-photo">{img('team-ten-years.jpg','iMED团队合影')}</div><div class="team-preview-text"><div class="eyebrow">A CROSS-DISCIPLINARY COMMUNITY</div><h2>一群人，做一件<br>有长期价值的事</h2><p>团队拥有计算机图像处理、大数据分析、医学、光学、生物医学工程、公共卫生及统计学等多学科背景。我们相信，真实的临床问题需要跨越学科边界的共同回答。</p><a class="text-link" href="about.html">认识 iMED 中国 {icon('arrow')}</a></div></div></section><section class="section"><div class="container resources-strip"><div><div class="eyebrow">OPEN SCIENCE</div><h2 class="section-title">数据与代码</h2><p>开放数据集、评测基准与研究代码，支持可复现的医学影像研究，也欢迎更多同行参与共建。</p><a class="button outline" href="datasets.html">浏览资源 {icon('arrow')}</a></div><div class="resource-compact"><a class="resource-tile" href="datasets.html#corn"><span><strong>CORN</strong><small>Corneal nerve dataset</small></span>{icon('arrow')}</a><a class="resource-tile" href="datasets.html#rose"><span><strong>ROSE</strong><small>Retinal OCT-A dataset</small></span>{icon('arrow')}</a><a class="resource-tile" href="datasets.html#costa"><span><strong>COSTA</strong><small>TOF-MRA database</small></span>{icon('arrow')}</a><a class="resource-tile" href="https://github.com/iMED-Lab" target="_blank" rel="noreferrer"><span><strong>GitHub</strong><small>iMED-Lab projects</small></span>{icon('arrow')}</a></div></div></section>''')

def news_page():
    rows = ''.join(news_row(n) for n in NEWS)
    return page('新闻动态','news', banner('新闻动态','NEWS','关注 iMED 的科研进展、学术活动与团队故事') + f"""<section class="content-section"><div class="container" data-collection data-page-size="6" data-unit="条动态">{section_heading("WHAT'S NEW",'最新消息')}<div class="filters" data-filters><button data-category="全部" aria-pressed="true">全部</button><button data-category="论文发表" aria-pressed="false">论文发表</button><button data-category="学术活动" aria-pressed="false">学术活动</button><button data-category="团队活动" aria-pressed="false">团队活动</button><select data-year aria-label="按年份筛选"><option value="">全部年份</option><option>2026</option></select><input class="list-search" data-list-search type="search" placeholder="搜索动态"></div><div class="list-info"><span data-count></span><span>按时间倒序</span></div><div class="list-rows">{rows}</div><div class="empty" data-empty hidden>暂无符合条件的动态。</div><div class="pagination" data-pagination hidden><button data-prev>上一页</button><span data-page-label>1 / 1</span><button data-next>下一页</button></div></div></section>""")

def team_page():
    people = [('yitian-zhao.png','Yitian Zhao','赵一天','研究员 · 团队负责人 PI','教授 / 研究员'),('yuanyuan-gu.jpg','Yuanyuan Gu','顾愿愿','高级工程师','科研骨干'),('', 'Shaodong Ma','马韶东','高级工程师','科研骨干'),('', 'Qifeng Yan','阎岐峰','副研究员','科研骨干'),('', 'Huilin Zhou','周慧琳','助理研究员','科研骨干'),('', 'Lei Mou','牟磊','博士后','青年研究者'),('', 'Huaying Hao','郝华颖','博士后','青年研究者'),('', 'Hanwen Zhao','赵翰文','博士后','青年研究者'),('', 'Xingyu Yue','岳星宇','工程师','科研支持'),('', 'Sijie Yang','杨思杰','科研助理','科研支持')]
    cards=''
    for file,en,cn,role,category in people:
        photo = img(file, cn) if file else f'<div class="initial">{escape(cn[:1])}</div>'
        cards += f'<article class="person-card" data-item data-category="{category}"><div class="person-photo">{photo}</div><div class="person-info"><small>{escape(en)}</small><h3>{escape(cn)}</h3><p>{escape(role)}</p></div></article>'
    return page('团队成员','team', banner('团队成员','OUR TEAM','来自计算机、医学、光学与生物医学工程等领域的交叉团队') + f"""<section class="content-section"><div class="container" data-collection data-page-size="10" data-unit="位成员"><p class="people-intro">iMED 中国汇聚研究员、工程师、博士后和硕博研究生，围绕医学影像分析与临床智能诊疗开展长期合作。</p><div class="filters" data-filters><button data-category="全部" aria-pressed="true">全部</button><button data-category="教授 / 研究员" aria-pressed="false">研究员</button><button data-category="科研骨干" aria-pressed="false">科研骨干</button><button data-category="青年研究者" aria-pressed="false">博士后</button><button data-category="科研支持" aria-pressed="false">科研支持</button></div><div class="people-grid">{cards}</div><div class="empty" data-empty hidden>暂无符合条件的成员。</div><div class="pagination" data-pagination hidden><button data-prev>上一页</button><span data-page-label>1 / 1</span><button data-next>下一页</button></div></div></section>""")

def research_page():
    details=[('analysis','医学影像分析','Biomedical Image Analysis','围绕医学图像的分割、检测、配准与结构化理解，研究可泛化、可解释的深度学习方法，并面向真实临床任务验证模型性能。','multimodal-imaging.png',['Segmentation','Detection','Topology']),('ophthalmology','眼科智能诊疗','AI for Ophthalmology','面向眼底、OCT 与 OCTA 等眼科影像，开展血管分析、病变识别和眼脑联合计算，帮助临床更早发现疾病风险。','retina-analysis.png',['Fundus','OCT / OCTA','Eye–Brain']),('trustworthy','可信医学人工智能','Trustworthy Medical AI','关注跨设备、跨中心数据上的模型泛化与不确定性估计，探索面向源自由学习和低标注场景的可靠影像分割方法。','octa-segmentation.png',['Uncertainty','Domain Generalization','Clinical AI']),('navigation','影像导航与机器人','Image-guided Navigation','将影像理解、三维结构重建和智能控制连接起来，为手术规划、介入导航与精准治疗提供算法基础。','vessel-topology.png',['3D Reconstruction','Navigation','Robotics'])]
    html=''.join(f'<article class="research-detail" id="{anchor}"><div class="research-detail-img">{img(file,title)}<div class="image-caption">iMED research visual · {english}</div></div><div><div class="eyebrow">{english}</div><h2>{title}</h2><p>{desc}</p><div class="tags">'+''.join(f'<span>{tag}</span>' for tag in tags)+f'</div><a class="text-link" href="publications.html">查看相关成果 {icon("arrow")}</a></div></article>' for anchor,title,english,desc,file,tags in details)
    return page('研究方向','research', banner('研究方向','RESEARCH TOPICS','从医学影像中提取结构、功能与风险，为精准诊疗提供可信的智能工具') + f"""<section class="content-section"><div class="container"><div class="notice">我们的研究从真实临床需求出发，强调算法、数据与应用场景的闭环。以下方向相互交叉，共同构成 iMED 的研究版图。</div>{html}</div></section>""")

def datasets_page():
    data=[('CORN','Corneal nerve fiber dataset','角膜神经纤维数据集，包含共聚焦显微镜图像及神经纤维标注，支持角膜神经结构分析。','corn','https://doi.org/10.5281/zenodo.12776091','1698 CCM images'),('VETO','Vessel topology dataset','血管拓扑人工标注数据集，用于树状结构重建、动静脉分类与拓扑估计研究。','veto','https://imed.nimte.ac.cn/ssel-pology-groundtruth.html','Topology annotation'),('ROSE','Retinal OCT-Angiography dataset','视网膜 OCT-A 血管分割数据集，包含 ROSE-1 与 ROSE-2 两个子集。','rose','https://github.com/iMED-Lab/ROSE','117 OCTA images'),('SURE','Super-resolution reconstruction dataset','OCTA 图像超分辨率重建数据集，覆盖不同设备与视野，支持图像质量提升研究。','sure','datasets.html#sure','1640 image pairs'),('COSTA','TOF-MRA cerebrovascular database','多中心、多厂商 TOF-MRA 脑血管分割数据库，覆盖 8 个数据中心和 4 家设备厂商。','costa','https://doi.org/10.5281/zenodo.11025761','423 TOF-MRA images'),('ORIGA-650','Fundus image dataset','经典眼底影像数据集，原站注明该数据已不再对公众提供下载。','origa','#','No longer available')]
    cards=''.join(f'<article class="dataset-card" id="{anchor}"><div class="dataset-top"><h2>{name}</h2><span class="pill">OPEN DATA</span></div><h3>{title}</h3><p>{desc}</p><div class="meta"><span>{stat}</span><a class="text-link" href="{href}" target="_blank" rel="noreferrer">访问资源 {icon("arrow")}</a></div></article>' for name,title,desc,anchor,href,stat in data)
    return page('数据资源','datasets', banner('数据资源','OPEN DATASETS','开放数据与研究代码，支持可复现的医学影像研究') + f"""<section class="content-section"><div class="container"><div class="notice">数据集仅供学术研究使用。下载与使用请遵循各数据集页面的许可、申请与引用要求。</div><div class="dataset-grid">{cards}</div></div></section>""")

def publications_page():
    pubs=[('IOVS · JAHA','2026','Retinal and Choroidal Vascular Metrics Predict Cerebral Atrophy and Cognitive Impairment in Noninfarcted Large Artery Stenosis','vascular-metrics'),('IEEE TIP','2026','Consistency-guided Uncertainty Estimation for Source-Free Medical Image Segmentation','uncertainty'),('Medical Image Analysis','2026','A Frequency-aware Dual-domain Collaborative Framework for Medical Image Enhancement','enhancement'),('IEEE TMI','2026','Beyond Correlation: Causal Intervention for Multi-Label Medical Image Diagnosis','causal'),('MICCAI','2026','Nine MICCAI Papers have been accepted this year','miccai'),('Medical Image Analysis','2020','CS2-Net: Deep Learning Segmentation of Curvilinear Structures in Medical Imaging','cs2')]
    items=''.join(f'<article class="publication-item"><div class="publication-journal">{journal}<small>{year}</small></div><div><h2>{title}</h2><p>iMED China · Intelligent Medical Imaging</p></div><a class="text-link" href="article.html?id={slug}">详情 {icon("arrow")}</a></article>' for journal,year,title,slug in pubs)
    return page('科研成果','publications', banner('科研成果','PUBLICATIONS','以可复现的方法和可验证的临床价值，持续回答医学影像中的真实问题') + f"""<section class="content-section"><div class="container">{section_heading('SELECTED PUBLICATIONS','代表性论文')}<div class="publication-list">{items}</div><div class="notice" style="margin-top:30px">完整论文列表与作者主页请访问 <a href="https://ytianzhao.github.io/" target="_blank" rel="noreferrer" style="color:var(--teal)">Yitian Zhao · Publications</a>。</div></div></section>""")

def about_page():
    return page('关于我们','team', banner('关于 iMED','ABOUT iMED','Intelligent Medical Imaging China · 精准医疗与医工交叉') + f"""<section class="content-section"><div class="container intro-grid"><div class="prose"><h2>用影像连接算法与临床</h2><p>iMED 中国（Intelligent Medical Imaging China）是中国科学院宁波材料技术与工程研究所的智能医学影像团队，成立于 2016 年。</p><p>团队以“精准医疗”为核心方向，聚焦医学影像分析、眼科影像、眼脑联合计算和临床智能诊疗。我们希望与医院、医疗影像设备企业以及国内外高校和科研机构开展长期合作，共同推动医学影像技术从实验室走向真实世界。</p><p>团队成员来自计算机图像处理、大数据分析、医学、光学、生物医学工程、公共卫生及统计学等不同背景。多学科的交汇，让我们能够从临床问题出发，构建有实际价值的研究方法。</p></div><div>{img('team-ten-years.jpg','iMED十周年团队活动')}<div class="image-caption">iMED 十周年团队活动 · 2026</div></div></div></section>""")

def contact_page():
    return page('联系方式','', banner('联系方式','CONTACT','欢迎与我们交流合作、访问团队或申请加入') + f"""<section class="content-section"><div class="container contact-layout"><div><div class="eyebrow">GET IN TOUCH</div><h2 class="section-title">与 iMED 联系</h2><div class="contact-row"><span>地址 / ADDRESS</span><strong>浙江省宁波市慈溪市白沙路街道学林路99号</strong></div><div class="contact-row"><span>邮编 / POSTCODE</span><strong>315300</strong></div><div class="contact-row"><span>联系人 / CONTACT</span><strong>岳星宇</strong></div><div class="contact-row"><span>电子邮箱 / EMAIL</span><strong><a href="mailto:yuexingyu@nimte.ac.cn">yuexingyu@nimte.ac.cn</a></strong></div></div><div class="contact-art"><h2>宁波 · 慈溪</h2><p>iMED China<br>Intelligent Medical Imaging</p></div></div></section>""")

def recruitment_page():
    return page('加入我们','recruitment', banner('加入我们','JOIN US','欢迎对医学影像、计算机视觉和临床人工智能有热情的同学与同行加入') + f"""<section class="content-section"><div class="container"><div class="intro-grid"><div class="prose"><h2>在真实问题中成长</h2><p>我们欢迎计算机、自动化、生物医学工程、医学及相关专业的博士后、博士生、硕士生和科研助理。你将参与从数据、算法到临床验证的完整研究流程。</p><p>如果你关注医学分割、生成式模型、眼科影像、可信 AI 或多模态学习，欢迎先通过邮件介绍自己的研究兴趣与经历。</p><a class="button" href="mailto:yuexingyu@nimte.ac.cn?subject=iMED%20申请咨询">发送申请邮件 {icon('arrow')}</a></div><div class="contact-art"><h2>Research<br>with purpose.</h2><p>让每一次实验，都更接近真实的临床价值。</p></div></div><h2 class="section-subtitle">当前招募方向</h2><div class="dataset-grid"><article class="dataset-card"><div class="dataset-top"><h2>博士后</h2><span class="pill">OPEN</span></div><h3>医学影像分析 / 可信 AI</h3><p>围绕医学图像分割、生成、跨域泛化与临床应用开展研究。</p><a class="text-link" href="mailto:yuexingyu@nimte.ac.cn?subject=博士后申请">咨询岗位 {icon('arrow')}</a></article><article class="dataset-card"><div class="dataset-top"><h2>博士生</h2><span class="pill">OPEN</span></div><h3>智能医学影像与眼科影像</h3><p>欢迎有扎实数学、编程和深度学习基础的同学联系我们。</p><a class="text-link" href="mailto:yuexingyu@nimte.ac.cn?subject=博士生申请">咨询岗位 {icon('arrow')}</a></article><article class="dataset-card"><div class="dataset-top"><h2>硕士生</h2><span class="pill">OPEN</span></div><h3>医工交叉科研实践</h3><p>以临床问题为导向，参与数据整理、模型研发与实验验证。</p><a class="text-link" href="mailto:yuexingyu@nimte.ac.cn?subject=硕士生申请">咨询岗位 {icon('arrow')}</a></article></div></div></section>""")

ARTICLES = {
    'vascular-metrics': ('Two papers have been accepted by IOVS and JAHA','2026-09-03','论文发表','团队两项研究分别发表于 Investigative Ophthalmology & Visual Science（IOVS）与 Journal of the American Heart Association（JAHA）。','Retinal and Choroidal Vascular Metrics Predict Cerebral Atrophy and Cognitive Impairment in Noninfarcted Large Artery Stenosis；Retinal Microvascular Abnormalities, White Matter Injury, and Cognitive Impairment in Carotid Stenosis or Occlusion。'),
    'uncertainty': ('Consistency-guided Uncertainty Estimation for Source-Free Medical Image Segmentation','2026-08-28','论文发表','团队研究成果发表于 IEEE Transactions on Image Processing（TIP）。','研究围绕源自由医学图像分割中的不确定性估计展开，关注模型在缺少目标域标注时的适应能力与结果可信度。'),
    'enhancement': ('A Frequency-aware Dual-domain Collaborative Framework for Medical Image Enhancement','2026-08-21','论文发表','团队研究成果发表于 Medical Image Analysis。','研究提出频率感知的双域协同框架，用于提升医学影像质量，为后续分析任务提供更稳定的图像基础。'),
    'causal': ('Beyond Correlation: Causal Intervention for Multi-Label Medical Image Diagnosis','2026-05-25','论文发表','团队研究成果发表于 IEEE Transactions on Medical Imaging（TMI）。','研究关注多标签医学影像诊断中的因果干预与相关性偏差，探索更稳健的诊断模型。'),
    'miccai': ('Nine MICCAI Papers have been accepted this year','2026-06-13','论文发表','团队今年共有九篇 MICCAI 论文录用，覆盖医学影像分割、生成和智能分析等方向。','我们将持续更新会议后的论文信息，感谢团队成员与合作伙伴在长期研究中的投入。'),
    'cmr': ('高可信心血管磁共振智能分析专题讲座：无造影剂微血管阻塞识别','2026-07-30','学术活动','iMED中国第七十三讲学术分享会邀请程骏教授，围绕无造影剂动态心脏磁共振成像中的微血管阻塞识别展开报告。','报告讨论了动态心脏磁共振中的时序信息、临床标注稀缺、模型泛化与真实临床部署等关键问题，为心血管智能影像分析提供了新的研究视角。'),
    'anniversary': ('青春作伴，十载同行——iMED十周年暨第九届“iMED杯”羽毛球赛圆满举行','2026-06-15','团队活动','六月的微风吹拂着毕业季，也迎来了 iMED 团队建组十周年的重要时刻。','我们以运动、美食与相聚，共同记录十年团队传承。愿每一位 iMED 成员带着团队的祝福与力量，在新的征程中继续追光前行。'),
    'graduation': ('智能医学影像团队硕士研究生毕业答辩顺利举行','2026-05-15','团队新闻','毕业答辩是研究生阶段的重要节点，也是新的起点。','祝愿每一位毕业生在未来的学习与工作中继续保持好奇、严谨与热爱。')
}

def article_page():
    import re
    # The default keeps direct links readable even when the page is opened without JS.
    articles_json=json.dumps(ARTICLES,ensure_ascii=False)
    script=f'''<script>const articles={articles_json};const id=new URLSearchParams(location.search).get('id')||'vascular-metrics';const a=articles[id]||articles['vascular-metrics'];document.title=a[0]+'｜iMED中国';document.querySelector('[data-article-title]').textContent=a[0];document.querySelector('[data-article-date]').textContent=a[1];document.querySelector('[data-article-category]').textContent=a[2];document.querySelector('[data-article-lead]').textContent=a[3];document.querySelector('[data-article-body]').innerHTML=a[4].split('；').map(p=>'<p>'+p+'。</p>').join('');</script>'''
    content = banner('动态详情','NEWS DETAIL','iMED 中国 · 研究进展与团队动态') + f"""<section class="content-section"><div class="container article-layout"><article><div class="eyebrow" data-article-category>论文发表</div><h1 class="article-title" data-article-title>正在加载动态标题</h1><div class="article-meta"><div class="meta"><span data-article-date>2026-09-03</span><span>iMED China</span></div></div><p class="prose" data-article-lead>正在加载动态摘要</p><div class="article-body" data-article-body><p>正在加载正文内容。</p></div><div class="article-source">内容整理自 iMED 中国公开官网归档。如需引用，请以正式论文或原始公告为准。</div></article><aside class="article-aside"><h3>相关内容</h3><a href="news.html">返回新闻动态 {icon('arrow')}</a><a href="publications.html">浏览科研成果 {icon('arrow')}</a><a href="research.html">了解研究方向 {icon('arrow')}</a></aside></div></section>{script}"""
    return page('动态详情','news', content)

if __name__ == '__main__':
    raise SystemExit('Run python build.py to generate the site from the archive.')

