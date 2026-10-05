"""Rebuild the static site from the read-only iMED archive. Python 3.10+.

Run: python build.py --archive ../website-archive-2026-10-05
The generated site has no runtime dependencies. No remote site is modified.
"""
import argparse
import base64
import hashlib
import io
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from html import escape as e
from bs4 import BeautifulSoup
from PIL import Image, ImageOps
import _build_site as t

parser=argparse.ArgumentParser()
parser.add_argument('--archive', default=str(Path(__file__).resolve().parent.parent/'website-archive-2026-10-05'))
args=parser.parse_args()
archive=Path(args.archive)
out=Path(__file__).resolve().parent
pages=json.loads((archive/'catalog/pages.json').read_text(encoding='utf8'))
manifest=json.loads((archive/'catalog/manifest.json').read_text(encoding='utf8'))
hierarchy=json.loads((archive/'catalog/hierarchy.json').read_text(encoding='utf8'))
by_slug={Path(urlsplit(p['url']).path).name or 'index.html':p for p in pages}
by_url={p['url']:p for p in pages}
resources={r['url'].replace('http://','https://'):r for r in manifest if r.get('ok') and not r.get('is_html')}
media=out/'assets/media';media.mkdir(parents=True,exist_ok=True)
assets={}; missing=[]
aliases={'lab-members.html':'team.html','download.html':'datasets.html','articles.html':'publications.html','recruit.html':'recruitment.html','intro.html':'about.html','aboutus.html':'english.html','contacts.html':'contact.html','Code.html':'codes.html','sharingconference.html':'events.html','tuanduifengcaiimed.html':'culture.html','english.html':'english.html'}
article_alias={'vascular-metrics':'view-34075.html','uncertainty':'view-34076.html','enhancement':'view-34077.html','causal':'view-34078.html','miccai':'view-34079.html','cmr':'view-34007.html','anniversary':'view-33580.html','graduation':'view-33501.html','cs2':'research-archive.html'}

def asset(src, origin='https://imed.nimte.ac.cn/'):
    if not src:return ''
    url=urljoin(origin,src).replace('http://','https://')
    if url in assets:return assets[url]
    data=None;name=''
    if src.startswith('data:image/'):
        try:data=base64.b64decode(src.split(',',1)[1]);name='embedded'
        except ValueError:return ''
    else:
        r=resources.get(url)
        if r:
            p=archive/'original'/r['path'];name=p.stem
            if p.exists():data=p.read_bytes()
        if data is None:
            p=archive/'original'/urlsplit(url).netloc/urlsplit(url).path.lstrip('/')
            if p.exists() and p.is_file():data=p.read_bytes();name=p.stem
    if data is None:missing.append(url);return url if url.startswith(('https://','http://')) else ''
    digest=hashlib.sha256(data).hexdigest()[:16]
    try:
        im=Image.open(io.BytesIO(data));im=ImageOps.exif_transpose(im);im.thumbnail((1600,1600))
        target=media/(digest+'.webp')
        if not target.exists():im.save(target,'WEBP',quality=86,method=4)
    except Exception:
        ext=Path(urlsplit(url).path).suffix.lower()
        if ext not in ['.pdf','.zip','.doc','.docx','.xls','.xlsx','.txt','.rar','.7z']:return url
        target=media/(digest+ext);target.write_bytes(data)
    assets[url]='assets/media/'+target.name
    return assets[url]

def local_url(href,origin):
    if not href:return ''
    if href.startswith('#'):return href
    url=urljoin(origin,href);parts=urlsplit(url)
    if parts.scheme not in ['http','https','mailto']:return ''
    if parts.netloc=='imed.nimte.ac.cn':
        slug=Path(parts.path).name or 'index.html'
        if slug in by_slug:return aliases.get(slug,slug)+(('#'+parts.fragment) if parts.fragment else '')
        if url.replace('http://','https://') in resources:return asset(url)
    return url

def clean(p):
    s=BeautifulSoup(p['content_html'],'html.parser')
    for bad in s.find_all(['script','style','iframe','form','input','button','object','embed','link','meta']):bad.decompose()
    root=s.find(id='content') or s.find(id='right') or s.body or s
    for tag in root.find_all(True):
        old=dict(tag.attrs);tag.attrs={}
        if old.get('id'):tag['id']=old['id']
        if tag.name=='img':
            src=asset(old.get('src',''),p['url'])
            if not src or src.startswith(('http:','https:','file:')):
                tag.name='span';tag['class']='missing-source-image';tag.string='[原始资料中的此图片暂不可用]'
                continue
            tag['src']=src;tag['alt']=old.get('alt') or p['title']+' · 图片';tag['loading']='lazy';tag['decoding']='async'
        elif tag.name=='a':
            href=local_url(old.get('href',''),p['url'])
            if href:tag['href']=href
            if href.startswith(('http://','https://')):tag['target']='_blank';tag['rel']='noopener noreferrer'
        elif tag.name in ['td','th']:
            for key in ['colspan','rowspan']:
                if old.get(key):tag[key]=old[key]
    # Drop the legacy title and page-view footer; publication text stays verbatim.
    first=root.find(['h1','h2'])
    if first and first.get_text(' ',strip=True)==p['title']:first.decompose()
    for node in list(root.find_all(string=re.compile(r'(更新日期|Update：|查看次数)'))):
        par=node.parent
        if par and len(par.get_text())<140:par.decompose()
    for table in root.find_all('table'):
        wrap=s.new_tag('div');wrap['class']='table-scroll';table.wrap(wrap)
    return ''.join(str(x) for x in root.contents)

def meta_date(p):
    m=re.search(r'(?:更新日期：|Update：)\s*(\d{4}-\d{2}-\d{2})',p['main_text']);return m.group(1) if m else ''

def category(p):
    title=p['title']
    if re.search(r'accepted|paper|论文|发表|MICCAI',title,re.I):return '论文发表'
    if re.search(r'讲|论坛|分享|报告|会议|访问|交流|研讨',title):return '学术活动'
    return '团队活动'

news_urls=next(x['pages'] for x in hierarchy if x['name']=='News')
event_urls=next(x['pages'] for x in hierarchy if x['name']=='iMED分享会')
news_pages=[by_url[u] for u in dict.fromkeys(news_urls+event_urls) if u in by_url and re.search(r'/view-\d+\.html$',u)]
news_pages.sort(key=lambda p:meta_date(p),reverse=True)
t.NEWS=[(meta_date(p) or '2016-01-01',category(p),p['title'],Path(urlsplit(p['url']).path).name,'') for p in news_pages]
t.SEARCH=[]
for p in pages:
    slug=Path(urlsplit(p['url']).path).name or 'index.html'
    if p['title']=='提示信息' or '-page' in slug:continue
    text=re.sub(r'\s+',' ',p['main_text'])
    t.SEARCH.append(dict(title=p['title'],category=category(p) if slug.startswith('view-') else '栏目 / 资源',url=aliases.get(slug,slug),text=text[:12000],date=meta_date(p)))

# Keep only image regions in the designed homepage. Source illustrations remain intact in detail pages.
original=archive/'original/imed.nimte.ac.cn'
def crop(source,dest,box=None):
    im=Image.open(original/source.lstrip('/'));im=ImageOps.exif_transpose(im)
    if box:im=im.crop(box)
    im.thumbnail((1400,1200));im.save(media/dest,'WEBP',quality=91)
crop('/uploadfiles/site35/202009/20200923104155-4175944417.png','hero-vessels.webp',(0,0,343,343))
crop('/uploadfiles/site35/202103/20210328215812-5399035859.png','fundus.webp',(0,0,245,193))
crop('/uploadfiles/site35/202009/20200923104155-4175944417.png','vessel-mask.webp',(343,0,687,343))
crop('/uploadfiles/site35/202103/20210328225134-9306320268.png','vessel-research.webp')
crop('/uploadfiles/site35/202103/20210328221511-9826521862.png','topology.webp')
crop('/uploadfiles/site35/202103/20210328225827-2172850413.png','enhancement.webp')
crop('/uploadfiles/site35/202505/20250522084932-3303035438.png','eye-brain.webp',(55,231,1210,632))
crop('/uploadfiles/site39/202606/20260615130241-6562510360.jpg','team.webp')
crop('/uploadfiles/site39/202606/20260629053350-3435938477.jpg','anniversary.webp')

old_write=t.write
def write(name,html):
    for a,b in article_alias.items():html=html.replace('article.html?id='+a,b)
    for source,dest in [('multimodal-imaging.png','vessel-research.webp'),('retina-analysis.png','fundus.webp'),('octa-segmentation.png','vessel-mask.webp'),('vessel-topology.png','topology.webp'),('team-ten-years.jpg','team.webp')]:html=html.replace(source,dest)
    # Search is cached once for the entire site instead of duplicated in every document.
    html=re.sub(r'<script>window\.IMED_SEARCH=.*?</script>','<script src="assets/search-index.js" defer></script>',html,flags=re.S)
    html=html.replace('<script src="assets/app.js"></script>','<script src="assets/app.js" defer></script>')
    html=re.sub(r'<a\s+[^>]*href="https://imed.nimte.ac.cn/aboutus.html"[^>]*>English</a>','<a href="english.html">English</a>',html)
    html=html.replace('<dialog class="search-dialog"','<dialog aria-labelledby="search-title" class="search-dialog"').replace('<h2>搜索 iMED</h2>','<h2 id="search-title">搜索 iMED</h2>')
    html=html.replace('id="site-search" type="search"','id="site-search" aria-label="搜索研究、论文、数据集或成员" type="search"').replace('id="search-summary"','id="search-summary" aria-live="polite"')
    html=html.replace('id="site-search" placeholder=', 'id="site-search" aria-label="搜索研究、论文、数据集或成员" placeholder=')
    html=html.replace('viewbox=', 'viewBox=')
    html=html.replace('中国科学院宁波材料所 · 医疗影像/眼科影像团队</span>','<a href="admin/">内容管理</a> · 中国科学院宁波材料所</span>')
    old_write(name,html)

home=t.home();s=BeautifulSoup(home,'html.parser')
s.select_one('.retina-globe img')['src']='assets/media/hero-vessels.webp'
s.select_one('.retina-globe img')['alt']='视网膜 OCTA 血管影像'
s.select_one('.retina-globe img')['loading']='eager'
s.select_one('.retina-globe img')['fetchpriority']='high'
s.select_one('.scan-a img')['src']='assets/media/fundus.webp';s.select_one('.scan-a img')['alt']='眼底影像';s.select_one('.scan-a span').clear();s.select_one('.scan-a span').append('FUNDUS · 眼底影像')
s.select_one('.scan-b img')['src']='assets/media/vessel-mask.webp';s.select_one('.scan-b img')['alt']='视网膜血管人工标注';s.select_one('.scan-b span').clear();s.select_one('.scan-b span').append('SEGMENTATION · 血管标注')
s.select_one('.science-label.bottom').string='RETINAL IMAGING · iMED'
s.select_one('.feature-photo img')['src']='assets/media/anniversary.webp'
for i,row in enumerate(s.select('[data-home-news]')):
    if i>=4:row['hidden']=''
    if i>=28:row.decompose()
# Current research areas follow the archived research page and latest publications.
cards=s.select('.research-card')
cards[3]['href']='research.html#eye-brain';cards[3].select_one('img')['src']='assets/media/eye-brain.webp';cards[3].select_one('img')['alt']='眼脑联合计算研究图'
cards[3].select_one('h3').string='眼脑联合计算';cards[3].select_one('p').string='探索视网膜微血管与脑健康的联系，寻找无创的疾病风险评估方法。'
cards[2].select_one('img')['src']='assets/media/enhancement.webp'
s.select('.pub-card')[0].select_one('h3').string='Retinal and Choroidal Vascular Metrics Predict Cerebral Atrophy and Cognitive Impairment in Noninfarcted Large Artery Stenosis'
s.select('.pub-card')[0].select_one('.journal').string='IOVS / JAHA · 论文录用动态'
write('index.html',str(s))

# All archived detail pages retain their original body text and verified source URL.
reserved={'index.html','news.html','research.html','lab-members.html','download.html','articles.html','recruit.html','intro.html','aboutus.html','contacts.html','contact.html','english.html','Code.html','sharingconference.html','tuanduifengcaiimed.html'}
for p in pages:
    slug=Path(urlsplit(p['url']).path).name or 'index.html'
    if slug in reserved:continue
    if p['title']=='提示信息':
        write(slug,t.page('历史页面不可用','news',t.banner('历史页面不可用','ARCHIVE NOTICE','原站文档不存在或已被删除。')+'<section class="content-section"><div class="container"><p class="notice">归档时原网站已无法提供此页面正文。你可以返回动态列表查看其他内容。</p><a class="button" href="news.html">返回新闻动态 →</a></div></section>'))
        continue
    date=meta_date(p);cat=category(p);body=clean(p)
    warning='<div class="notice">这是一则历史招募公告（2020 年）。名额、待遇与申请要求请以团队最新确认为准。</div>' if slug in ['view-19582.html','view-18874.html'] else ''
    content=t.banner('内容详情','iMED ARCHIVE','科研进展、学术交流与开放资源')+f'''<section class="content-section"><div class="container article-layout"><article><div class="eyebrow">{e(cat)}</div><h1 class="article-title">{e(p['title'])}</h1><div class="article-meta meta"><time>{date}</time><span>iMED 中国</span></div>{warning}<div class="article-body">{body}</div><div class="article-source">来源：<a href="{e(p['url'])}" target="_blank" rel="noopener noreferrer">iMED 原始页面 ↗</a> · 资料整理于 2026-10-05</div></article><aside class="article-aside"><h3>继续探索</h3><a href="news.html">新闻动态 →</a><a href="publications.html">科研成果 →</a><a href="datasets.html">数据与代码 →</a><a href="team.html">团队成员 →</a><a href="events.html">iMED 分享会 →</a></aside></div></section>'''
    write(slug,t.page(p['title'],'news' if slug.startswith('view-') else '',content))

def news_page(name='news.html',events=False,culture=False):
    selected=[n for n in t.NEWS if (not events or n[1]=='学术活动') and (not culture or n[1]=='团队活动')]
    title='iMED 分享会' if events else '团队风采' if culture else '新闻动态'
    years=sorted({n[0][:4] for n in selected},reverse=True)
    filters=''.join(f'<button data-category="{c}" aria-pressed="{str(i==0).lower()}">{c}</button>' for i,c in enumerate(['全部','论文发表','学术活动','团队活动'])) if not events and not culture else ''
    rows=''.join(t.news_row(n) for n in selected)
    opts=''.join(f'<option>{y}</option>' for y in years)
    content=t.banner(title,'NEWS & EVENTS','记录科研的每一步，也记录同行的每一程。')+f'''<section class="content-section"><div class="container" data-collection data-page-size="12" data-unit="条动态"><div class="filters" data-filters>{filters}<select data-year aria-label="选择年份"><option value="">全部年份</option>{opts}</select><input class="list-search" aria-label="搜索动态" data-list-search type="search" placeholder="输入标题关键词"></div><div class="list-info"><span data-count></span><a href="events.html">iMED 学术分享会 →</a></div><div class="list-rows">{rows}</div><p data-empty class="empty" hidden>没有符合条件的动态，请调整筛选条件。</p><div data-pagination class="pagination"><button data-prev>上一页</button><span data-page-label></span><button data-next>下一页</button></div></div></section>'''
    write(name,t.page(title,'news',content))
news_page();news_page('events.html',events=True);news_page('culture.html',culture=True)

# Convert the actual member table into responsive profile cards, including students and alumni.
members=BeautifulSoup(by_slug['lab-members.html']['content_html'],'html.parser');group='研究人员';people=[]
for row in members.select('tr'):
    cells=row.find_all('td',recursive=False)
    for cell in cells:
        texts=[x for x in cell.stripped_strings if x.strip('\u200b\xa0 ')]
        text=' '.join(texts)
        if not text:continue
        if not cell.find('img'):
            if 'Professors' in text:group='研究人员'
            elif 'Students' in text:group='在读学生'
            elif text=='客聘研究员':group='客聘专家'
            elif '毕业生/已离组' in text:group='毕业校友'
            continue
        link=cell.find('a',href=True);pic=cell.find('img');name=texts[0];rest=' '.join(texts[1:]);cn=re.search(r'[\u4e00-\u9fff]{2,4}',name);en=re.sub(r'[\u4e00-\u9fff].*','',name).strip()
        # Chinese-only student names include their academic status in the same line.
        if not en:
            m=re.match(r'([\u4e00-\u9fff]{2,3})\s*(.*)',name)
            if m:cn_name=m[1];rest=(m[2]+' '+rest).strip()
            else:cn_name=name
        else:cn_name=cn[0] if cn else name
        href=local_url(link.get('href'),by_slug['lab-members.html']['url']) if link else ''
        people.append((cn_name,en,rest,asset(pic.get('src')),group,href))
cards=[]
for name,en,role,src,group,href in people:
    link=f'<a href="{e(href)}">个人介绍 →</a>' if href else ''
    cards.append(f'<article class="person-card" data-item data-category="{group}"><div class="person-photo"><img src="{e(src)}" alt="{e(name)}" loading="lazy"></div><div class="person-info"><small>{e(en) if en else "iMED CHINA"}</small><h3>{e(name)}</h3><p>{e(role)}</p>{link}</div></article>')
filters=''.join(f'<button data-category="{g}" aria-pressed="{str(i==0).lower()}">{g}</button>' for i,g in enumerate(['全部','研究人员','在读学生','客聘专家','毕业校友']))
content=t.banner('团队成员','OUR PEOPLE','多学科交叉，在交流与协作中探索医学影像的更多可能。')+f'''<section class="content-section"><div class="container" data-collection data-page-size="20" data-unit="位成员"><div class="filters" data-filters>{filters}<input class="list-search" data-list-search type="search" placeholder="搜索姓名或研究生院校" aria-label="搜索成员"></div><div class="list-info"><span data-count></span><span>成员资料来自团队公开介绍</span></div><div class="people-grid">{''.join(cards)}</div><div data-empty class="empty" hidden>没有找到该成员。</div><div data-pagination class="pagination"><button data-prev>上一页</button><span data-page-label></span><button data-next>下一页</button></div></div></section>'''
write('team.html',t.page('团队成员','team',content))

research=t.research_page().replace('id="navigation"','id="eye-brain"').replace('影像导航与机器人','眼脑联合计算').replace('Image-guided Navigation','Eye–Brain Joint Computing').replace('将影像理解、三维结构重建和智能控制连接起来，为手术规划、介入导航与精准治疗提供算法基础。','以视网膜作为观察脑健康的窗口，研究眼底微血管、脑白质损伤与认知功能之间的联系，探索无创的风险评估方法。').replace('3D Reconstruction','Retinal Biomarkers').replace('Navigation','Brain Health').replace('Robotics','Multimodal Learning')
rs=BeautifulSoup(research,'html.parser');rs.select('#eye-brain img')[0]['src']='assets/media/eye-brain.webp';rs.select('#trustworthy img')[0]['src']='assets/media/enhancement.webp'
write('research.html',str(rs))
write('research-archive.html',t.page('研究资料','research',t.banner('研究资料','RESEARCH DETAILS','研究方向与相关代表论文')+'<section class="content-section"><div class="container article-body">'+clean(by_slug['research.html'])+'</div></section>'))

# Curated publications preserve the exact original titles; status is acceptance, not an invented publication record.
pubs=[('IOVS / JAHA','2026','Retinal and Choroidal Vascular Metrics Predict Cerebral Atrophy and Cognitive Impairment in Noninfarcted Large Artery Stenosis','view-34075.html','论文录用 · 眼脑联合研究'),('IOVS / JAHA','2026','Retinal Microvascular Abnormalities, White Matter Injury, and Cognitive Impairment in Carotid Stenosis or Occlusion','view-34075.html','论文录用 · 眼脑联合研究'),('IEEE TIP','2026','Consistency-guided Uncertainty Estimation for Source-Free Medical Image Segmentation','view-34076.html','论文录用 · 医学图像分割'),('MedIA','2026','A Frequency-aware Dual-domain Collaborative Framework for Medical Image Enhancement','view-34077.html','论文录用 · 医学图像增强'),('IEEE TMI','2026','Beyond Correlation: Causal Intervention for Multi-Label Medical Image Diagnosis','view-34078.html','论文录用 · 辅助诊断'),('IEEE TMI','2020','ROSE: A Retinal OCT-Angiography Vessel Segmentation Dataset and New Model','dataofrose.html','数据集与模型 · OCTA 血管分割'),('MedIA','2020','CS2-Net: Deep Learning Segmentation of Curvilinear Structures in Medical Imaging','research-archive.html','医学图像分析 · 细线结构分割')]
items=''.join(f'<article class="publication-item" data-item data-year="{year}"><div class="publication-journal">{journal}<small>{year}</small></div><div><h2>{e(title)}</h2><p>{desc}</p></div><a class="text-link" href="{url}">查看详情 →</a></article>' for journal,year,title,url,desc in pubs)
content=t.banner('科研成果','PUBLICATIONS','从结构分割到辅助诊断，让研究成果回应临床需求。')+f'''<section class="content-section"><div class="container" data-collection><div class="filters"><select data-year aria-label="论文年份"><option value="">全部年份</option><option>2026</option><option>2020</option></select><input data-list-search class="list-search" type="search" aria-label="搜索论文" placeholder="搜索论文标题或研究主题"></div><div class="list-info"><span data-count></span><a href="https://ytianzhao.github.io/" target="_blank" rel="noreferrer">完整发表列表 ↗</a></div><div class="publication-list">{items}</div><p data-empty class="empty" hidden>没有符合条件的论文。</p><div class="notice" style="margin-top:30px">以上展示部分代表成果；2026 年成果依据团队论文录用公告整理。<a href="archives.html">历年文献 →</a>　<a href="fund.html">项目基金 →</a></div></div></section>'''
write('publications.html',t.page('科研成果','publications',content))

data=[('ROSE','OCTA 血管分割','包含 ROSE-1（117 张）与 ROSE-2（112 张）影像，提供视网膜血管标注和研究代码。','rose','dataofrose.html','学术研究'),('CORN','角膜神经纤维分析','包含角膜共聚焦显微镜影像；CORN-1 提供 1698 张影像，用于神经分割与形态分析。','corn','CORN.html','学术研究'),('VETO','血管拓扑估计','血管拓扑人工标注数据，为树状血管结构重建与拓扑估计提供研究基础。','veto','ssel-pology-groundtruth.html','学术研究'),('COSTA','多中心脑血管分割','汇集 8 个数据中心、4 家厂商的 423 例 TOF-MRA 影像，支持跨中心脑血管研究。','costa','costa.html','学术研究'),('SURE','OCTA 超分辨率重建','包含 1640 张影像（820 对扫描）。原始页面尚未提供下载链接，可先阅读数据说明。','sure','sure.html','下载待开放'),('ORIGA-650','眼底图像分析','原站已明确停止公开下载。请使用其他开放数据，或联系团队咨询。','origa',None,'已停止下载')]
cards=''.join(f'<article class="dataset-card" id="{anchor}"><div class="dataset-top"><h2>{name}</h2><span class="pill">{status}</span></div><h3>{title}</h3><p>{desc}</p>'+ (f'<a class="text-link" href="{url}">数据说明与使用方式 →</a>' if url else '<span class="meta">不再提供公开下载</span>')+'</article>' for name,title,desc,anchor,url,status in data)
content=t.banner('数据与代码','OPEN SCIENCE','分享数据、算法与工具，让医学影像研究更开放、更可复现。')+f'<section class="content-section"><div class="container"><div class="notice">请遵守原始数据集的学术研究用途、许可及引用要求。各详情页保留原始下载与申请入口。</div><div class="dataset-grid">{cards}</div><h2 class="section-subtitle">研究代码</h2><div class="resource-compact"><a class="resource-tile" href="https://github.com/iMED-Lab/ROSE" target="_blank" rel="noreferrer"><span><strong>ROSE</strong><small>OCTA-Net 与评测模型</small></span>↗</a><a class="resource-tile" href="https://github.com/iMED-Lab/CS-Net" target="_blank" rel="noreferrer"><span><strong>CS-Net</strong><small>细线结构分割</small></span>↗</a></div><p style="margin-top:24px"><a class="text-link" href="codes.html">查看全部代码入口 →</a></p></div></section>'
write('datasets.html',t.page('数据与代码','datasets',content))
write('codes.html',t.page('研究代码','datasets',t.banner('研究代码','RESEARCH CODE','公开实现与复现资源')+'<section class="content-section"><div class="container"><div class="resource-compact"><a class="resource-tile" href="https://github.com/iMED-Lab/ROSE" target="_blank" rel="noreferrer">ROSE / OCTA-Net ↗</a><a class="resource-tile" href="https://github.com/iMED-Lab/CS-Net" target="_blank" rel="noreferrer">CS-Net / CS2-Net ↗</a><a class="resource-tile" href="https://github.com/iMED-Lab/WRB-Net" target="_blank" rel="noreferrer">WRB-Net ↗</a><a class="resource-tile" href="https://ytianzhao.github.io/" target="_blank" rel="noreferrer">完整论文与代码索引 ↗</a></div></div></section>'))

write('about.html',t.about_page().replace('</div></section>','</div></section>',1).replace('<h2>用影像连接算法与临床</h2>','<h2>用影像连接算法与临床</h2>'))
write('contact.html',t.contact_page())
recruit=t.banner('加入我们','JOIN iMED','在医学与人工智能的交汇处，共同探索有价值的研究问题。')+'''<section class="content-section"><div class="container"><div class="intro-grid"><div class="prose"><h2>让好奇心，走向真实的问题</h2><p>我们关注医学影像、眼科智能分析与疾病诊断，欢迎计算机、图像处理、统计、数学及数据分析等方向的同学与科研人员交流。</p><p>招生、联培与科研岗位请先阅读原始公告，再联系团队确认最新安排。</p><a class="button" href="mailto:yuexingyu@nimte.ac.cn?subject=iMED申请咨询">联系团队 →</a></div><div class="contact-art"><h2>Research<br>with purpose.</h2><p>让每一次探索，更接近真实的临床价值。</p></div></div><h2 class="section-subtitle">招生与岗位信息</h2><div class="notice">下列公告发布于 2020 年，供了解研究方向与申请流程。当前名额、岗位与待遇请向团队确认。</div><div class="resource-compact"><a class="resource-tile" href="view-19582.html"><span><strong>研究生招生</strong><small>硕士 / 博士 / 联合培养 · 2020-07-16</small></span>→</a><a class="resource-tile" href="view-18874.html"><span><strong>科研岗位</strong><small>研究员 / 博士后 / 工程师 · 2020-03-18</small></span>→</a></div></div></section>'''
write('recruitment.html',t.page('加入我们','recruitment',recruit))
eng=clean(by_slug['aboutus.html'])
write('english.html',t.page('About iMED China','team',t.banner('iMED China','INTELLIGENT MEDICAL IMAGING','Advancing medical image analysis through interdisciplinary collaboration.')+'<section class="content-section english-page"><div class="container article-body">'+eng+'</div></section>').replace('<html lang="zh-CN">','<html lang="en">'))

# Useful legacy URLs continue to resolve when copied from the former navigation.
for old,new in aliases.items():
    if old==new:continue
    redirect=f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={new}"><title>iMED 页面跳转</title></head><body><a href="{new}">打开新版页面 →</a></body></html>'
    old_write(old,redirect)
write('article.html',t.page('内容导航','news',t.banner('内容导航','EXPLORE','请从新闻动态或科研成果中选择具体文章。')+'<section class="content-section"><div class="container"><a class="button" href="news.html">浏览新闻动态 →</a></div></section>'))
write('404.html',t.page('页面未找到','',t.banner('暂未找到这个页面','404','可以返回首页，或使用右上角搜索查找研究内容。')+'<section class="content-section"><div class="container"><a class="button" href="index.html">返回首页 →</a></div></section>'))
# No external services are required to serve or search the public site.
(out/'assets/search-index.js').write_text('window.IMED_SEARCH='+json.dumps(t.SEARCH,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')+';',encoding='utf8')
(out/'.nojekyll').touch()
(out/'assets/source-map.json').write_text(json.dumps({'archive_date':'2026-10-05','assets':{k:v for k,v in assets.items() if not k.startswith('data:')},'missing_source_assets':sorted(set(missing))},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'html_pages':len(list(out.glob('*.html'))),'news_items':len(news_pages),'members':len(people),'assets':len(assets),'unavailable_source_assets':len(set(missing))},ensure_ascii=False))
