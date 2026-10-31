/* Local persistent workspace. All business data comes from the same server snapshot. */
(() => {
  'use strict';
  const esc = value => escapeHTML(String(value ?? ''));
  const basePages = { home, enterprise: enterprisePage, regulations: regulationsPage, duties: dutiesPage, archives: archivesPage, ...(window.workspacePages || {}) };
  // Data readiness controls facts and statuses, never the visibility of demonstration features.
  const defaultViews = { home: 'demo', enterprise: 'live', regulations: 'live', duties: 'demo', archives: 'demo', graph: 'live', reporting: 'demo', scene: 'demo', facility: 'live' };
  const originalHandlers = {};
  const local = { mode: 'local', pageViews: {}, ready: false, csrf: '', projects: [], snapshot: null, capabilities: {}, system: null, library: null, libraryQuery: '', legalQuery: '', legalFilter: 'all', legalPage: 0, error: '', feedback: '', selectedCase: '', draft: null, dirty: false, selectedDocument: '', documentDetail: null, documentLocator: '', documentQuery: '', documentPage: 0, archiveElement: '', graphExpanded: false, uploading: false, requestId: 0 };
  const kinds = { design: '安全设计专篇 / 建设资料', environment: '环境影响评价 / 环评', permit: '作业票 / 承包商记录', policy: '制度 / 工作依据', procedure: '操作规程', roster: '人员名单', training: '培训记录', regulatory: '政府监管文件', other: '其他企业资料' };
  const statusText = { parsed: '已提取内容', needs_ocr: '待 OCR 识别', unsupported: '暂不支持解析', parse_failed: '解析失败' };
  const evaluationText = { pending: '待核实', gap: '关联存在缺口', complete: '本次关联满足', not_applicable: '已确认不适用' };
  const industries = ['矿山', '危险化学品', '金属冶炼', '建筑施工', '道路运输'];
  const cities = ['呼和浩特市', '包头市', '呼伦贝尔市', '兴安盟', '通辽市', '赤峰市', '锡林郭勒盟', '乌兰察布市', '鄂尔多斯市', '巴彦淖尔市', '乌海市', '阿拉善盟'];
  const docs = () => local.snapshot?.documents || [];
  const cases = () => local.snapshot?.cases || [];
  const currentCase = () => cases().find(c => c.id === local.selectedCase) || cases()[0];
  const project = () => local.snapshot?.project;
  const projectPath = (id, suffix) => `/api/projects/${encodeURIComponent(id)}${suffix}`;
  const apiPath = suffix => projectPath(project().id, suffix);
  const dateText = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
  const tag = (label, tone = 'muted') => `<span class="lw-tag ${tone}">${esc(label)}</span>`;
  const button = (text, action, extra = '', secondary = false) => `<button type="button" class="${secondary ? 'secondary-btn' : 'primary-btn'}" data-action="${action}" ${extra}>${text}</button>`;
  const empty = (title, text, action = '') => `<section class="lw-empty card">${icon('layers')}<h2>${esc(title)}</h2><p>${esc(text)}</p>${action}</section>`;
  const selected = (a, b) => String(a ?? '') === String(b ?? '') ? 'selected' : '';
  const checked = value => value === true ? 'checked' : '';
  const triValue = value => value === true ? 'true' : value === false ? 'false' : '';
  const triParse = value => value === 'true' ? true : value === 'false' ? false : null;
  const tri = (name, value, yes = '是', no = '否') => `<select name="${name}"><option value="">待核实</option><option value="true" ${selected(triValue(value), 'true')}>${yes}</option><option value="false" ${selected(triValue(value), 'false')}>${no}</option></select>`;
  const field = (label, content, wide = false) => `<label class="lw-field${wide ? ' wide' : ''}"><span>${label}</span>${content}</label>`;
  const input = (name, value, type = 'text', attrs = '') => `<input type="${type}" name="${name}" value="${esc(value)}" ${attrs}>`;
  const documentName = id => docs().find(d => d.id === id)?.name || '未选择原件';
  const docOptions = value => `<option value="">请选择已保存原件</option>${docs().map(d => `<option value="${esc(d.id)}" ${selected(value, d.id)}>${esc(d.name)} · ${esc(statusText[d.status] || d.status)}</option>`).join('')}`;
  const locatorOptions = (documentId, value) => `<option value="">请选择内容位置</option>${(docs().find(d => d.id === documentId)?.segments || []).map(s => `<option value="${esc(s.locator)}" ${selected(value, s.locator)}>${esc(s.locator)} · ${esc(s.text).slice(0, 72)}</option>`).join('')}`;
  const sourceFields = (prefix, documentId, locator, heading) => `<div class="lw-source-fields">${field(`${heading}原件`, `<select name="${prefix}DocumentId" data-lw-source="${prefix}">${docOptions(documentId)}</select>`)}${field('原件内容位置', `<select name="${prefix}Locator">${locatorOptions(documentId, locator)}</select>`)}</div>`;
  const originalLink = d => `<a class="lw-text-link" href="demo-docs/${encodeURIComponent(d.id)}.txt" target="_blank" rel="noopener">查看原件 ↗</a>`;
  function modelReady() { const c = local.capabilities; return c.modelConfigured === true || c.model?.configured === true || c.harness?.configured === true || local.system?.model?.configured === true || local.system?.modelConfigured === true; }
  async function request(path, options = {}) {
    const s = window.MXZ_PUBLIC_SNAPSHOT;
    if (options.method && options.method !== 'GET') throw new Error('公开演示版使用虚构样本，不保存修改或上传资料。需要完整服务请返回蔚动星辰官网咨询。');
    if (path === '/api/bootstrap') return {csrfToken:'public-demo', projects:[s.project], capabilities:s.capabilities};
    if (path === '/api/system') return {version:'public-demo',capabilities:s.capabilities,storage:{mode:'公开静态样本',persistent:false},notice:'演示快照，不连接本地数据库或模型服务。'};
    if (path === '/api/library') return {sources:[]};
    if (path.endsWith('/facility')) return {facility:structuredClone(s.facility)};
    if (path.includes('/documents/')) {const id=path.split('/documents/')[1].split('/')[0];return {document:structuredClone(s.documents.find(d=>d.id===id))};}
    if (path.startsWith('/api/projects/')) return structuredClone(s);
    throw new Error('该操作需要完整工作空间，公开演示版暂不提供。');
  }
  function applySnapshot(snapshot, resetDraft = false) {
    if (!snapshot?.project) return;
    const changedProject = local.snapshot?.project?.id !== snapshot.project.id;
    local.snapshot = snapshot;
    if (changedProject) { local.legalQuery = ''; local.legalFilter = 'all'; local.legalPage = 0; local.libraryQuery = ''; }
    if (snapshot.capabilities) local.capabilities = { ...local.capabilities, ...snapshot.capabilities };
    if (!cases().some(c => c.id === local.selectedCase)) local.selectedCase = cases()[0]?.id || '';
    if (resetDraft || !local.draft) { local.draft = currentCase() ? structuredClone(currentCase().data) : null; local.dirty = false; }
  }
  async function refreshProject(projectId, resetDraft = true) {
    const id = ++local.requestId;
    const snapshot = await request(`/api/projects/${encodeURIComponent(projectId)}`);
    if (id !== local.requestId) return;
    applySnapshot(snapshot, resetDraft);
    try { localStorage.setItem('mxz.localProject', projectId); } catch {}
  }
  function displayError(error) { local.error = error.message || '操作未完成，请重试。'; if (error.details) local.error += ' ' + (Array.isArray(error.details) ? error.details.map(x => `${x.field || ''} ${x.message || x}`).join('；') : String(error.details)); local.feedback = ''; render(); }
  function redraw() { if (local.mode === 'local') render(); updateChrome(); }
  function updateChrome() {
    const isLocal = local.mode === 'local';
    document.body.classList.toggle('local-workspace', isLocal);
    document.querySelectorAll('[data-nav]').forEach(n => { n.hidden = false; });
    const switcher = document.querySelector('.enterprise-switch');
    if (switcher) switcher.innerHTML = `${icon('building')}<span><b>${esc(isLocal ? project()?.name || '创建企业工作空间' : '北疆化工 · 演示企业')}</b><small>${esc(isLocal ? [project()?.city, project()?.site].filter(Boolean).join(' · ') || '本地数据 · 尚未建档' : '内蒙古 · 鄂尔多斯市')}</small></span>${icon('chevrons')}`;
    const badge = document.querySelector('.demo-badge');
    if (badge) badge.innerHTML = `<span></span>${isLocal ? (project() ? '公开演示 · 虚构样本' : '完整功能演示') : '原版演示工作空间'}`;
    const footer = document.querySelector('.page-footer small');
    if (footer) footer.textContent = isLocal ? '公开展示版 · 全部企业、人员、票证与统计为虚构样本 · 不代表实时状态或安全判断' : '当前为交互演示，企业、任务及统计均为示例数据。';
    document.querySelectorAll('.nav-count,.nav-dot').forEach(n => n.hidden = isLocal);
    document.querySelector('.sidebar-version span').textContent = isLocal ? '公开演示 · 2026.10' : '工作台预览 V1.3';
    let toggle = document.getElementById('lw-mode-toggle');
    if (!toggle) { toggle = document.createElement('button'); toggle.id = 'lw-mode-toggle'; toggle.className = 'lw-mode-toggle'; toggle.dataset.action = 'lw-toggle'; document.querySelector('.topbar-right')?.prepend(toggle); }
    toggle.textContent = isLocal ? '查看原版演示' : '返回企业演示';
  }
  function feedback() { return `${local.error ? `<div class="lw-notice error" role="alert">${icon('alert')}<span>${esc(local.error)}</span>${button('关闭', 'lw-dismiss', '', true)}</div>` : ''}${local.feedback ? `<div class="lw-notice success" role="status">${icon('check-circle')}<span>${esc(local.feedback)}</span></div>` : ''}`; }
  function title(name, text) { return `<div class="welcome-row lw-heading"><div><div class="eyebrow">MENG XIAO ZHI / LOCAL WORKSPACE</div><h1>${esc(name)}</h1><p>${esc(text)}</p></div><div class="lw-heading-actions">${project() ? button(`${icon('upload')}添加资料`, 'lw-upload-open', '', true) : ''}</div></div>`; }
  function currentView(name) { return local.pageViews[name] || defaultViews[name] || 'live'; }
  function presentationHeader(name) {
    const view = currentView(name), supportsBoth = !!basePages[name] && !['scene','reporting','facility'].includes(name);
    const p = project(), snapshot = local.snapshot;
    const names = {home:'工作总览',enterprise:'企业资料',regulations:'法规与监管资料',duties:'履职展示',archives:'标准化档案',graph:'合规关系图谱',scene:'今日现场',reporting:'监管上报',facility:'企业动态沙盘'};
    const note = view === 'demo' ? '本页保留原设计的完整功能，图表、计划、人员和报送记录为演示样例；企业实据可通过页面内的资料入口查看。' : '本页使用已保存的企业资料；其他功能仍完整保留，未接通的模块继续展示演示样例。';
    return `<section class="lw-presentation-context"><div class="lw-presentation-top"><div><span class="lw-kicker">${p ? '已接入企业资料' : '完整功能演示'}</span><strong>${esc(p?.name || '蒙小智安全总监工作台')}</strong><p>${p ? `${esc(p.industry)} · ${esc(p.city)} · ${docs().length} 份原件 · ${snapshot?.facility?.units?.length || 0} 个建设单元` : '原设计功能全部保留，可逐步加入企业资料。'}</p></div><div class="lw-presentation-actions">${button('企业资料与内检','lw-design-review','',true)}<a href="#facility" class="secondary-btn">建设沙盘 →</a></div></div><div class="lw-presentation-bottom"><span>${esc(note)}</span>${supportsBoth ? `<div class="lw-view-tabs" role="group" aria-label="${esc(names[name])}展示内容"><button data-action="lw-page-view" data-page="${name}" data-view="demo" aria-pressed="${view === 'demo'}">完整功能演示</button><button data-action="lw-page-view" data-page="${name}" data-view="live" aria-pressed="${view === 'live'}">虚构企业样本</button></div>` : tag(view === 'demo' ? '功能演示 · 示例数据' : '企业资料 · 原文可查',view === 'demo' ? 'pending' : 'saved')}</div></section>`;
  }
  function guarded(name, renderer) {
    queueMicrotask(updateChrome);
    if (!local.ready) return title('正在读取企业资料', '完整演示功能加载后即可查看。');
    const view = currentView(name);
    if (view === 'demo' && basePages[name]) return `<div class="lw-page lw-presentation" data-local-page="${name}" data-presentation-view="demo">${feedback()}${presentationHeader(name)}${basePages[name]()}</div>`;
    if (!project()) return title('从了解您的企业开始', '完整演示功能仍可从左侧菜单查看。') + feedback() + onboarding();
    return `<div class="lw-page" data-local-page="${name}" data-presentation-view="live">${feedback()}${presentationHeader(name)}${renderer()}</div>`;
  }
  function onboarding() { return `<div class="lw-onboarding"><section class="lw-onboarding-intro"><span class="lw-kicker">您的第一份企业工作档案</span><h2>用蒙小智管安全，<br>不做企业背锅人。</h2><p>先建立企业与实际场所，再上传现行制度、操作规程、人员和培训资料。系统从真实证据开始，逐步列出缺项与待核事项。</p><div class="lw-steps"><div><b>01</b><span>建立企业与场所</span></div><div><b>02</b><span>保存资料，核对事实</span></div><div><b>03</b><span>查看任务、档案与关联</span></div></div><small>五行业共用建档。本地首批执行规则聚焦操作规程变更与受影响人员培训；其他专项规则仍待建设。</small><div class="lw-sample-entry">${button('加载一套本地体验样本', 'lw-example', '', true)}<small>新建独立虚构企业与样本原件，体验完整保存和核对流程。</small></div></section>${projectForm()}</div>`; }
  function projectForm() { return `<form id="lw-project-form" class="card lw-form-panel"><h2>新建企业项目</h2><p class="lw-muted">填实际业务和场所，资料可以逐步补充。</p>${field('企业名称', input('name', '', 'text', 'required maxlength="120" placeholder="例如：某某化工有限公司"'))}${field('实际场所 / 厂区', input('site', '', 'text', 'required maxlength="120" placeholder="例如：鄂尔多斯一厂"'))}<div class="lw-form-grid">${field('主要行业', `<select name="industry">${industries.map(i => `<option>${i}</option>`).join('')}</select>`)}${field('所属盟市', `<select name="city">${cities.map(c => `<option>${c}</option>`).join('')}</select>`)}</div><button class="primary-btn" type="submit">创建本地企业工作空间 ${icon('arrow-right')}</button><small>项目数据保存在本机服务，不会部署或发送到政府平台。</small></form>`; }
  function casePicker() { return cases().length ? `<div class="lw-case-picker"><label>当前工作<select id="lw-case-select">${cases().map(c => `<option value="${esc(c.id)}" ${selected(currentCase()?.id, c.id)}>${esc(c.title)}</option>`).join('')}</select></label>${button(`${icon('plus')}新建工作`, 'lw-case-new', '', true)}</div>` : ''; }
  function caseRows(items = cases()) { return items.length ? `<div class="lw-case-list">${items.map(c => `<button type="button" class="lw-case-row" data-action="lw-case-open" data-id="${esc(c.id)}"><span class="lw-case-icon">${icon('tasks')}</span><span><b>${esc(c.title)}</b><small>${esc(c.data?.procedureNumber || '规程编号待核实')} · ${esc(c.data?.version || '版本待核实')} · 更新于 ${dateText(c.updatedAt)}</small></span>${tag(evaluationText[c.evaluation?.status] || '待首次核对', c.evaluation?.status || 'pending')}${c.evaluation?.historicalIssues?.length ? tag('有历史问题', 'gap') : ''}${icon('arrow-right')}</button>`).join('')}</div>` : cases().length ? '<div class="lw-inline-empty">当前已保存工作没有待处理的关联缺口。历史记录仍可在履职展示查看。</div>' : empty('还没有真实工作记录', '从一项操作规程修订工作开始，核对依据、人员和对应培训。', button('新建规程变更工作', 'lw-case-new')); }
  function docRows(items = docs(), compact = false) { return items.length ? `<div class="lw-doc-list">${items.map(d => `<article class="lw-doc-row"><span class="lw-doc-icon">${icon('file')}</span><div class="lw-doc-name"><button type="button" data-action="lw-document" data-id="${esc(d.id)}">${esc(d.name)}</button><small>${esc(kinds[d.kind] || d.kind)} · ${(d.size / 1024).toFixed(1)} KB · ${dateText(d.createdAt)}</small><span>${tag('原件已保存', 'saved')}${tag(statusText[d.status] || d.status, d.status === 'parsed' ? 'muted' : 'pending')}</span></div>${compact ? '' : originalLink(d)}</article>`).join('')}</div>` : `<div class="lw-inline-empty">暂未上传资料。已保存、已提取和已核对将分别显示。</div>`; }
  function allFindings() { return cases().flatMap(c => [...(c.evaluation?.findings || []).filter(f => f.status !== 'complete' && f.status !== 'not_applicable').map(f => ({ ...f, caseId: c.id, caseTitle: c.title })), ...(c.evaluation?.historicalIssues || []).map((h, i) => ({ key: `history-${i}`, status: 'historical', title: '当前材料齐备，仍有历史时点问题', detail: typeof h === 'string' ? h : h.detail || h.reason || JSON.stringify(h), nextAction: typeof h === 'string' ? h : h.detail || h.reason || '核对并处理保留的历史问题', caseId: c.id, caseTitle: c.title }))]); }
  function designReview() {
    const review = local.snapshot?.designReview;
    return review?.status === 'available' && docs().some(d => d.id === review.sourceDocumentId && d.projectId === project()?.id && d.status === 'parsed' && (!review.sourceVersion || !d.sha256 || review.sourceVersion === d.sha256)) ? review : null;
  }
  function designEvidence(items = []) {
    const valid = items.flatMap(e => {
      const d = docs().find(d => d.id === e.documentId && d.projectId === project()?.id);
      const segment = d?.segments?.find(s => s.locator === e.locator);
      return segment ? [{ ...e, name: d.name, quote: typeof e.quote === 'string' && segment.text.includes(e.quote) ? e.quote : segment.text }] : [];
    });
    return valid.length ? `<details class="lw-review-evidence"><summary>查看原文依据 · ${valid.length} 处</summary>${valid.map(e => `<blockquote><button type="button" class="lw-text-link" data-action="lw-document" data-id="${esc(e.documentId)}" data-locator="${esc(e.locator)}">${esc(e.name)} · ${esc(e.locator)} ↗</button><p>${esc(e.quote)}</p></blockquote>`).join('')}</details>` : '<small class="lw-muted">原文定位待核对，请查看来源原件。</small>';
  }
  function designRequests(limit = Infinity) {
    const review = designReview(); if (!review) return '';
    return `<div class="lw-review-requests">${(review.requests || []).slice(0, limit).map(r => `<article data-ui-card><div><h3>${esc(r.title)}</h3>${tag(r.status === 'provided' ? '已收到 · 待核充分性' : '尚未提供', r.status === 'provided' ? 'saved' : 'pending')}</div><p>${esc(r.reason)}</p>${button(r.status === 'provided' ? '继续补充' : '补充资料', 'lw-upload-open', `data-kind="${esc(Object.hasOwn(kinds, r.kind) ? r.kind : 'other')}"`, true)}</article>`).join('')}</div>`;
  }
  function designFindings(limit = Infinity) {
    const review = designReview(); if (!review) return '';
    return `<div class="lw-review-findings">${(review.findings || []).slice(0, limit).map(f => `<article data-ui-card><div class="lw-review-item-heading">${tag('原文待核事项', 'pending')}<h3>${esc(f.title)}</h3></div><p>${esc(f.detail)}</p>${f.nextAction ? `<strong>下一步：${esc(f.nextAction)}</strong>` : ''}${designEvidence(f.evidence)}</article>`).join('')}</div>`;
  }
  function designReviewPanel(mode = 'full') {
    const review = designReview(); if (!review) return '';
    const brief = mode === 'summary', tasks = mode === 'tasks';
    const pending = (review.requests || []).filter(r => r.status !== 'provided').length;
    const facts = (review.facts || []).filter(f => (f.evidence || []).some(e => docs().find(d => d.id === e.documentId && d.projectId === project()?.id)?.segments?.some(s => s.locator === e.locator)));
    return `<section class="card lw-panel lw-design-review" id="lw-design-review"><header><div><span class="lw-kicker">从建设资料开始 · 本地原文初评</span><h2>${tasks ? '专篇核对与资料补充待办' : '专篇初评 · 企业认识正在建立'}</h2><p class="lw-muted">${esc(review.sourceName || documentName(review.sourceDocumentId))}</p></div>${button('查看来源原件', 'lw-document', `data-id="${esc(review.sourceDocumentId)}"`, true)}</header><div class="lw-review-counts"><span><b>${(review.findings || []).length}</b> 项原文待核</span><span><b>${pending}</b> 类资料尚未提供</span><span>按已提取原文整理 · 待人工核对</span></div>${tasks ? '' : `<div class="lw-review-facts">${facts.slice(0, brief ? 4 : undefined).map(f => `<article data-ui-card><span>${esc(f.title)}</span><strong>${esc(f.value)}</strong>${brief ? '' : designEvidence(f.evidence)}</article>`).join('')}</div>`}${brief ? `<div class="lw-review-actions">${button('查看完整初评与原文', 'lw-design-review', '', true)}<a class="secondary-btn" href="#facility">查看建设单元沙盘 →</a><a class="secondary-btn" href="#graph">查看证据关系 →</a></div>` : `<h3>需要核对的原文事项</h3>${designFindings()}<h3>接下来需要补充的运行资料</h3>${designRequests()}`}<p class="lw-boundary">${esc(review.boundary || '专篇反映设计范围。待核事项与尚未提供的资料，不等于违法、未履职或现场风险结论；收到资料后还需核对内容与现行适用性。')}</p></section>`;
  }
  function homePage() {
    const count = s => cases().filter(c => c.evaluation?.status === s).length;
    const find = allFindings(), review = designReview();
    const metrics = review ? [['已保存原件', docs().length, '来源原件保存在本机'], ['专篇原文待核', (review.findings || []).length, '需核实口径，不作违规结论'], ['待补运行资料', (review.requests || []).filter(r => r.status !== 'provided').length, '尚未提供，不等于未开展'], ['引用版本待核', legalAttention(), '已变化、衔接或引用疑点']] : [['已保存原件', docs().length, '资料原件真实保存'], ['工作记录', cases().length, '同源台账与档案'], ['当前关联缺口', count('gap'), '完整范围内的记录缺口'], ['待核实工作', count('pending') + cases().filter(c => !c.evaluation).length, '资料或条件不足']];
    return `${title(`${state.name}安全总监，您好`, `${project().name} · ${project().site} · 从真实资料看清下一步工作`)}<section class="lw-hero"><div><span class="lw-kicker">有据可查 · 从容履职</span><h2>用蒙小智管安全，<br>不做企业背锅人。</h2><p>上传原件，核对关键事实，查看本次关联结果。<br>资料、工作与档案，使用同一份记录。</p></div><div class="lw-hero-actions">${button(`${icon('upload')}添加企业资料`, 'lw-upload-open')}${review ? button('查看专篇初评与待办', 'lw-design-review', '', true) : button(`${icon('plus')}建立一项工作`, 'lw-case-new', '', true)}<small>${modelReady() ? '模型已配置 · 分析候选仍需人工核对' : 'AI 解析待配置 · 当前可使用本地提取与规则核对'}</small></div></section><div class="lw-metrics">${metrics.map(([l,n,t]) => `<article class="card"><span>${l}</span><strong>${n}<small>项</small></strong><p>${t}</p></article>`).join('')}</div>${legalIntakePanel()}${designReviewPanel('summary')}<div class="lw-two-column"><section class="card lw-panel"><header><h2>优先处理的工作</h2><a href="#duties">全部工作 →</a></header>${review && !cases().length ? designFindings(3) + '<a class="lw-text-link" href="#duties">查看专篇核对与补资料待办 →</a>' : caseRows(cases().filter(c => c.evaluation?.status !== 'complete' || c.evaluation?.historicalIssues?.length).slice(0, 4))}</section><section class="card lw-panel"><header><h2>最近收到的资料</h2><a href="#enterprise">全部资料 →</a></header>${docRows(docs().slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4), true)}</section></div><div class="lw-two-column"><section class="card lw-panel"><header><h2>${review && !find.length ? '待补运行资料' : '资料与关联问题'}</h2>${tag(`${review && !find.length ? (review.requests || []).filter(r => r.status !== 'provided').length : find.length} 项`)}</header>${find.slice(0, 4).map(f => `<button class="lw-finding-link" data-action="lw-case-open" data-id="${esc(f.caseId)}"><b>${esc(f.title)}</b><span>${esc(f.nextAction || f.detail)}</span><small>${esc(f.caseTitle)}</small></button>`).join('') || (review ? designRequests(3) + '<button class="lw-text-link" data-action="lw-design-review">查看全部待补资料 →</button>' : '<p class="lw-muted">目前没有已生成的问题。尚未建立或核对的工作，不代表已经合规。</p>')}<div class="lw-boundary">风险评价方法尚未建立。本页不将资料数量或工作完成率换算为安全风险分。</div></section><section class="card lw-panel lw-regulatory-prompt"><span class="lw-kicker">当年政府监管文件</span><h2>有地方红头文件吗？</h2><p>自治区、盟市、旗县及园区的文件，收到多少先传多少。</p><strong>${docs().filter(d => d.kind === 'regulatory').length}<small>份已保存</small></strong>${tag('适用范围待核实', 'pending')}${button('补充政府监管文件', 'lw-upload-open', 'data-kind="regulatory"', true)}<small>文件数量不代表已覆盖全部适用要求。</small></section></div>`;
  }
  function uploadPanel() { return `<section class="card lw-panel lw-upload-panel" id="lw-upload-panel"><header><h2>上传并保存原件</h2>${tag('公开版不保存上传', 'saved')}</header><form id="lw-upload-form"><div class="lw-form-grid">${field('资料类别', `<select name="kind" id="lw-upload-kind">${Object.entries(kinds).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>`)}${field('选择文件（可多选）', '<input type="file" name="files" multiple required>')}</div><p class="lw-muted">文件会保存到本机。支持 PDF、Word、Excel、文本、CSV、JSON 及常见图片。${local.capabilities.ocr?.available ? '图片使用本机 OCR 提取' : '图片识别服务尚不可用'}；解析失败会明确提示，原件仍可查看。单份上限 ${Math.round((local.capabilities.maxUploadBytes || 15728640) / 1024 / 1024)} MB。</p><button type="submit" class="primary-btn" ${local.uploading ? 'disabled' : ''}>${icon('upload')}${local.uploading ? '正在保存与提取…' : '保存资料并提取内容'}</button><div id="lw-upload-progress" role="status" aria-live="polite"></div></form></section>`; }
  function enterprisePageLocal() { return `${title('企业资料', '原件、提取内容与人工核对，分别留有记录。')}<section class="card lw-project-summary"><div><h2>${esc(project().name)}</h2><p>${esc(project().industry)} · ${esc(project().city)} · ${esc(project().site)}</p></div>${button('切换 / 新建企业', 'lw-project-switch', '', true)}<a class="secondary-btn" href="demo-export.json">导出企业数据包</a></section>${legalIntakePanel()}${designReviewPanel()}${uploadPanel()}<section class="card lw-panel"><header><h2>企业原件库</h2><span>${docs().length} 份已保存</span></header>${docRows()}</section>${local.selectedDocument ? documentDetailPanel() : ''}`; }
  function documentFocusPanel(d) {
    const segments = d.segments || [], locator = local.documentLocator;
    if (!locator) return '';
    const index = segments.findIndex(s => s.locator === locator);
    if (index < 0) return `<div class="lw-boundary">当前提取结果未找到“${esc(locator)}”。可能已重新提取，请用下方搜索核对，或查看原件。</div>`;
    const segment = segments[index], neighbors = segments.slice(Math.max(0, index - 1), index + 2).filter(s => s !== segment);
    return `<section class="lw-document-focus" aria-label="引用定位"><header><div><span class="lw-kicker">引用直接定位</span><h3>${esc(segment.locator)}</h3></div>${tag(`第 ${index + 1} / ${segments.length} 个提取片段`, 'saved')}</header><pre>${esc(segment.text)}</pre>${neighbors.length ? `<details class="lw-details"><summary>查看相邻上下文 · ${neighbors.length} 处</summary>${neighbors.map(n => `<article><strong>${esc(n.locator)}</strong><pre>${esc(n.text)}</pre></article>`).join('')}</details>` : ''}</section>`;
  }
  function documentSegmentResults(d) {
    const all = d.segments || [], query = local.documentQuery.trim().toLocaleLowerCase(), compact = query.replace(/\s/g, '');
    const matches = all.filter(s => !query || String(s.text || '').toLocaleLowerCase().includes(query) || String(s.locator || '').toLocaleLowerCase().replace(/\s/g, '').includes(compact));
    const pageSize = 50, pages = Math.max(1, Math.ceil(matches.length / pageSize)), page = Math.max(0, Math.min(local.documentPage, pages - 1));
    const offset = page * pageSize, visible = matches.slice(offset, offset + pageSize);
    return `<div class="lw-segment-count" role="status" aria-live="polite"><b>${query ? `命中 ${matches.length} 处` : `已提取 ${all.length} 处`}</b><span>总计 ${all.length} 个提取片段 · 当前显示 ${matches.length ? offset + 1 : 0}–${offset + visible.length} 处</span></div><div class="lw-segments">${visible.map(segment => `<article class="${segment.locator === local.documentLocator ? 'lw-segment-selected' : ''}"><header><strong>${esc(segment.locator)}</strong>${button('定位与上下文', 'lw-segment-focus', `data-locator="${esc(segment.locator)}"`, true)}</header><pre>${esc(segment.text)}</pre></article>`).join('') || `<p class="lw-muted">${query ? '没有匹配片段。可尝试“5030”“表 59”或关键词；搜索覆盖全部已提取内容。' : '尚无可引用片段。请查看原件并补充可解析文本。'}</p>`}</div><div class="lw-segment-pagination">${button('上一页', 'lw-segment-page', `data-page="${page - 1}" ${page === 0 ? 'disabled' : ''}`, true)}<span>第 ${page + 1} / ${pages} 页 · 每页最多 ${pageSize} 处</span>${button('下一页', 'lw-segment-page', `data-page="${page + 1}" ${page >= pages - 1 ? 'disabled' : ''}`, true)}</div><p class="lw-muted">这里只分页展示已提取片段，其余内容可翻页或搜索。已提取片段数不等于原文页数，也不证明全文提取完整；完整文件请用“查看原件”。</p>`;
  }
  function refreshDocumentResults() {
    const d = local.documentDetail || docs().find(x => x.id === local.selectedDocument), target = document.getElementById('lw-segment-results');
    if (d && target) target.innerHTML = documentSegmentResults(d);
  }
  function documentDetailPanel() {
    const d = local.documentDetail || docs().find(x => x.id === local.selectedDocument);
    if (!d) return '';
    return `<section class="card lw-panel" id="lw-document-detail"><header><div><span class="lw-kicker">原件与提取证据</span><h2>${esc(d.name)}</h2></div><div class="lw-heading-actions">${originalLink(d)}${button('重新提取', 'lw-reparse', `data-id="${esc(d.id)}"`, true)}</div></header><div class="lw-doc-meta">${tag(statusText[d.status] || d.status, d.status === 'parsed' ? 'saved' : 'pending')}<span>${esc(kinds[d.kind] || d.kind)}</span><span>${dateText(d.createdAt)}</span></div><div id="lw-document-focus">${documentFocusPanel(d)}</div>${(d.warnings || []).map(w => `<p class="lw-boundary">${esc(typeof w === 'string' ? w : w.message || JSON.stringify(w))}</p>`).join('')}<div class="lw-model-row"><div><b>${modelReady() ? '模型已配置' : 'DeepSeek Harness 待配置'}</b><p>模型仅提出可核对的候选，不自动改写已确认事实或宣布合规。</p></div>${button('分析此文件', 'lw-analyze', `data-id="${esc(d.id)}" ${modelReady() ? '' : 'disabled'}`, true)}</div><details class="lw-details"><summary>识别候选与分析结果（需人工核对）</summary><pre>${esc(JSON.stringify(d.analysis || d.candidates || {}, null, 2))}</pre></details><div class="lw-document-search" id="lw-document-search">${field('搜索全部提取片段 · 关键词或原文位置', input('documentQuery', local.documentQuery, 'search', 'id="lw-document-query" placeholder="例如：段落 5030、表 59、重大危险源"'))}${button('清空搜索', 'lw-document-query-clear', '', true)}</div><div id="lw-segment-results">${documentSegmentResults(d)}</div><div class="lw-boundary">提取内容不等于事实已经确认。工作表单选择相应原件及位置后，再进行关联核对。</div></section>`;
  }
  function blankData() { return { applicability: 'unknown', applicabilityNote: '', procedureNumber: '', version: '', effectiveDate: '', inUse: null, procedureDocumentId: '', procedureLocator: '', policyDocumentId: '', policyLocator: '', requirementConfirmed: false, beforeUseRequired: null, assessmentRequired: null, rosterDocumentId: '', rosterLocator: '', people: [], training: [], coverage: { status: 'unknown', from: '', to: '', sourceDocumentIds: [], note: '' }, businessStatus: 'in_progress', notes: '' }; }
  function editorData() { return { ...blankData(), ...(local.draft || currentCase()?.data || {}), coverage: { ...blankData().coverage, ...(local.draft?.coverage || currentCase()?.data?.coverage || {}) } }; }
  function personRows(data) { return data.people.map((p, i) => `<div class="lw-person-row" data-person-row>${input('personId', p.id, 'text', 'placeholder="稳定员工编号" aria-label="人员编号"')}${input('personName', p.name, 'text', 'placeholder="姓名" aria-label="人员姓名"')}${button('移除', 'lw-person-remove', `data-index="${i}"`, true)}</div>`).join(''); }
  function trainingRows(data) { return data.training.map((t, i) => `<div class="lw-training-row" data-training-row><header><b>培训记录 ${i + 1}</b>${button('移除', 'lw-training-remove', `data-index="${i}"`, true)}</header><input type="hidden" name="trainingId" value="${esc(t.id)}"><div class="lw-form-grid">${field('人员编号', `<select name="trainingPerson"><option value="">请选择人员</option>${data.people.map(p => `<option value="${esc(p.id)}" ${selected(t.personId, p.id)}>${esc(p.id)} · ${esc(p.name)}</option>`).join('')}</select>`)}${field('培训对应版本', input('trainingVersion', t.version))}${field('培训日期', input('trainingDate', t.date, 'date'))}${field('考核通过', tri('trainingPassed', t.passed))}${field('培训原件', `<select name="trainingDocument" data-lw-training-source="${i}">${docOptions(t.documentId)}</select>`)}${field('内容位置', `<select name="trainingLocator">${locatorOptions(t.documentId, t.locator)}</select>`)}</div></div>`).join(''); }
  function caseEditor() {
    const c = currentCase(); if (!c) return caseRows();
    const d = editorData();
    return `<form id="lw-case-form" data-revision="${c.revision}" class="lw-case-form"><section class="card lw-panel"><header><div><span class="lw-kicker">规程变更 · 事实核对</span><h2>${esc(c.title)}</h2><p class="lw-muted">记录版本 ${c.revision} · ${local.dirty ? '有尚未保存的编辑' : '使用已保存事实'}。核对材料后保存，系统立即计算关联结果。</p></div>${tag(evaluationText[c.evaluation?.status] || '待核对', c.evaluation?.status || 'pending')}</header><div class="lw-form-grid">${field('本项工作适用性', `<select name="applicability"><option value="unknown" ${selected(d.applicability, 'unknown')}>条件不足，待核实</option><option value="applicable" ${selected(d.applicability, 'applicable')}>适用</option><option value="not_applicable" ${selected(d.applicability, 'not_applicable')}>有依据的不适用</option></select>`)}${field('业务进度（独立于关联结果）', `<select name="businessStatus"><option value="in_progress" ${selected(d.businessStatus, 'in_progress')}>进行中</option><option value="closed" ${selected(d.businessStatus, 'closed')}>业务已闭环</option></select>`)}${field('适用 / 不适用说明', `<textarea name="applicabilityNote" rows="2" placeholder="不适用时需说明依据，并关联已核实的制度原件">${esc(d.applicabilityNote)}</textarea>`, true)}${field('规程编号', input('procedureNumber', d.procedureNumber, 'text', 'placeholder="如 SOP-101"'))}${field('当前规程版本', input('version', d.version, 'text', 'placeholder="如 V3.0"'))}${field('版本生效日期', input('effectiveDate', d.effectiveDate, 'date'))}${field('当前是否已启用', tri('inUse', d.inUse, '已启用', '尚未启用'))}</div>${sourceFields('procedure', d.procedureDocumentId, d.procedureLocator, '操作规程')}</section><section class="card lw-panel"><header><h2>01 · 核对企业执行依据</h2>${tag('人工确认适用要求')}</header>${sourceFields('policy', d.policyDocumentId, d.policyLocator, '制度')}<label class="lw-check"><input type="checkbox" name="requirementConfirmed" ${checked(d.requirementConfirmed)}>我已核对所选依据及本工作适用要求</label><div class="lw-form-grid">${field('是否要求启用前培训', tri('beforeUseRequired', d.beforeUseRequired))}${field('是否要求培训考核通过', tri('assessmentRequired', d.assessmentRequired))}</div><p class="lw-muted">未知请保持待核实。未启用不等于不适用；仅上传制度不会自动确认要求。</p></section><section class="card lw-panel"><header><h2>02 · 明确受影响人员</h2>${button(`${icon('plus')}添加人员`, 'lw-person-add', '', true)}</header>${sourceFields('roster', d.rosterDocumentId, d.rosterLocator, '受影响人员名单')}<p class="lw-muted">使用稳定员工编号；同名人员不自动合并。人员名单仅录入本项工作受影响范围。</p><div id="lw-people">${personRows(d) || '<p class="lw-inline-empty">暂无受影响人员，请添加或导入。</p>'}</div></section><section class="card lw-panel"><header><h2>03 · 对应每人的培训记录</h2>${button(`${icon('plus')}添加培训记录`, 'lw-training-add', '', true)}</header><div id="lw-training">${trainingRows(d) || '<p class="lw-inline-empty">可先保存资料缺口，再补充真实记录。</p>'}</div></section><section class="card lw-panel"><header><h2>04 · 说明本次资料覆盖范围</h2>${tag('完整范围下才判记录缺口')}</header><div class="lw-form-grid">${field('已纳入资料范围', `<select name="coverageStatus"><option value="unknown" ${selected(d.coverage.status, 'unknown')}>尚不完整 / 待核实</option><option value="complete" ${selected(d.coverage.status, 'complete')}>所述期间完整</option></select>`)}${field('覆盖起始日', input('coverageFrom', d.coverage.from, 'date'))}${field('覆盖截止日', input('coverageTo', d.coverage.to, 'date'))}${field('范围说明', `<textarea name="coverageNote" rows="2" placeholder="说明已纳入哪些部门、人员、期间和记录">${esc(d.coverage.note)}</textarea>`, true)}</div><div class="lw-field"><span>证明覆盖范围的资料（可多选）</span><div class="lw-coverage-docs">${docs().map(x => `<label class="lw-check"><input type="checkbox" name="coverageDocument" value="${esc(x.id)}" ${(d.coverage.sourceDocumentIds || []).includes(x.id) ? 'checked' : ''}>${esc(x.name)}</label>`).join('') || '<p>请先上传原件。</p>'}</div></div>${field('补充说明', `<textarea name="notes" rows="2">${esc(d.notes)}</textarea>`, true)}</section><div class="lw-save-bar"><div><b>保存事实并核对关联</b><small>结果与历史在服务器保存。补传不消除历史问题。</small></div><button class="primary-btn" type="submit">${icon('check-circle')}保存并重新核对</button></div></form>${evaluationPanel(c)}${historyPanel(c)}`;
  }
  function evaluationPanel(c) {
    const e = c?.evaluation;
    if (!e) return empty('等待首次关联核对', '补充并确认关键事实后保存，系统将返回本次检查结果。');
    return `<section class="card lw-panel" id="lw-evaluation"><header><div><span class="lw-kicker">本次规则核对</span><h2>${esc(e.label || evaluationText[e.status])}</h2></div>${tag(evaluationText[e.status], e.status)}</header><p>${esc(e.reason)}</p><div class="lw-result-summary"><span>受影响人员 <b>${e.counts?.people ?? 0}</b></span><span>已匹配 <b>${e.counts?.matched ?? 0}</b></span><span>未匹配 <b>${e.counts?.missing ?? 0}</b></span></div><p class="lw-muted">${esc(typeof e.scope === 'string' ? e.scope : JSON.stringify(e.scope || {}))}</p><div class="lw-findings">${(e.findings || []).map(f => `<article class="lw-finding ${esc(f.status)}">${tag(evaluationText[f.status] || f.status, f.status)}<h3>${esc(f.title)}</h3><p>${esc(f.detail)}</p>${f.nextAction ? `<strong>下一步：${esc(f.nextAction)}</strong>` : ''}<div>${(f.documentIds || []).map(id => `<button class="lw-text-link" data-action="lw-document" data-id="${esc(id)}">${esc(documentName(id))} ↗</button>`).join('')}</div></article>`).join('')}</div>${(e.historicalIssues || []).length ? `<div class="lw-historical"><h3>需要保留的历史问题</h3>${e.historicalIssues.map(h => `<p>${esc(typeof h === 'string' ? h : h.detail || h.reason || JSON.stringify(h))}</p>`).join('')}</div>` : ''}<footer class="lw-boundary">规则版本 ${esc(e.ruleVersion)} · ${dateText(e.evaluatedAt)}。本次关联满足不等于全部法律义务或现场风险已核验。</footer></section>`;
  }
  function historyPanel(c) { const list = (local.snapshot.evaluations || []).filter(e => e.caseId === c.id).slice().sort((a,b) => new Date(b.evaluatedAt) - new Date(a.evaluatedAt)); return `<section class="card lw-panel"><header><h2>关联核对历史</h2><span>${list.length} 条</span></header>${list.map(e => `<details class="lw-details"><summary>${dateText(e.evaluatedAt)} · ${esc(e.label || evaluationText[e.status])} · ${esc(e.ruleVersion)}</summary><p>${esc(e.reason)}</p><pre>${esc(JSON.stringify({ findings: e.findings, historicalIssues: e.historicalIssues, inputsDigest: e.inputsDigest }, null, 2))}</pre></details>`).join('') || '<p class="lw-muted">保存并分析后保留结果版本。</p>'}</section>`; }
  function dutiesPageLocal() { const review = designReview(); return `${title('履职与关联核对', '先处理已有资料提出的核对事项，再按实际工作建立履职记录。')}${review ? designReviewPanel('tasks') : ''}${casePicker()}${review && !cases().length ? empty('尚未建立专项履职记录', '专篇初评与资料补充待办已列在上方。发生实际规程修订时，再建立对应工作记录。', button('登记实际规程修订工作', 'lw-case-new', '', true)) : caseEditor()}`; }
  function archiveLinks() {
    const out = [], seen = new Set();
    const add = a => { const key = `${a.documentId}|${a.element}`; if (!seen.has(key) && docs().some(d => d.id === a.documentId && d.projectId === project()?.id) && archiveElements.some(e => e.clause === a.element)) { out.push(a); seen.add(key); } };
    for (const c of cases()) for (const a of c.evaluation?.archiveLinks || []) add({ ...a, caseId: c.id });
    for (const a of designReview()?.archiveLinks || []) add({ ...a, referenceOnly: true });
    return out;
  }
  function archivesPageLocal() {
    const links = archiveLinks();
    const chosen = archiveElements.find(e => e.clause === local.archiveElement);
    return `${title('标准化档案', '保留 AQ/T 3034 的 20 要素目录，展示工作资料与设计专篇的参考归档。')}<section class="archive-standard-hero"><div class="archive-standard-copy"><span class="archive-kicker">PROCESS SAFETY MANAGEMENT</span><h2>AQ/T 3034—2022</h2><p>化工过程安全管理 · 20 个要素</p><small>${project().industry === '危险化学品' ? '当前采用此目录组织本地资料；具体要求按适用情况核对' : '当前为参考目录，尚未确认适用于本企业行业；不可据此宣布标准化达标'}</small></div><div class="archive-hero-stats"><div><b>${new Set(links.map(a => a.documentId)).size}</b><span>已关联原件</span></div><div><b>${links.length}</b><span>要素关联</span></div></div></section><div class="lw-boundary">保存原件、形成目录关联、满足具体要求是不同状态。专篇初评提供参考归档；履职规则保留真实工作关联。任何要素中的资料数量均不代表完成度或标准化达标。</div><div class="element-grid">${archiveElements.map((e,i) => { const n = links.filter(a => a.element === e.clause).length; return `<button class="element-card" data-action="lw-archive-element" data-element="${esc(e.clause)}"><div class="element-card-top"><span class="element-number">${String(i+1).padStart(2,'0')}</span><span class="element-clause">§ ${e.clause}</span>${icon('folder')}</div><h3>${esc(e.name)}</h3><p>${esc(e.desc)}</p><footer><span>${n} 份关联原件</span><span>${n ? '查看证据' : '待建立关联'}</span></footer></button>`; }).join('')}</div>${chosen ? `<section class="card lw-panel" id="lw-archive-detail"><header><h2>${chosen.clause} ${esc(chosen.name)}</h2></header>${links.filter(a => a.element === chosen.clause).map(a => { const d = docs().find(d => d.id === a.documentId); return d ? `<article class="lw-archive-link"><div><b>${esc(d.name)}</b><p>${esc(a.reason)}</p>${a.referenceOnly ? tag('专篇参考归档 · 待核内容', 'pending') : ''}</div>${originalLink(d)}${a.caseId ? button('关联工作', 'lw-case-open', `data-id="${esc(a.caseId)}"`, true) : button('查看提取依据', 'lw-document', `data-id="${esc(d.id)}"`, true)}</article>` : ''; }).join('') || '<p class="lw-muted">尚未形成此要素的资料关联。未核对要素保持待核，不标记为合规或材料齐备。</p>'}</section>` : ''}`;
  }
  function graphPageLocal() {
    if (!window.MXZGraphExplorer || !window.MXZGraphModel) return title('合规关系图谱', '图谱模块加载中，请刷新页面重试。');
    const snapshot = local.snapshot;
    queueMicrotask(() => window.MXZGraphExplorer.mount(document.getElementById('mxg-explorer'), {
      snapshot, focusFindingId: local.graphFindingId || '',
      onFocusConsumed: () => {local.graphFindingId = '';},
      onOpenFacility: separationId => {local.facilitySeparationId = separationId; goto('facility');},
      onOpenDocument: (id, locator) => handlers['lw-document']({ dataset: { id, locator } }),
      onOpenCase: id => handlers['lw-case-open']({ dataset: { id } })
    }));
    return window.MXZGraphExplorer.template(snapshot);
  }
  function facilityPageLocal() {
    const snapshot = local.snapshot;
    queueMicrotask(() => window.MXZFacility.mount(document.getElementById('mxf-app'), {
      snapshot, request, focusSeparationId: local.facilitySeparationId || '',
      onFocusConsumed: () => {local.facilitySeparationId = '';},
      onOpenCompliance: id => {local.graphFindingId = id; goto('graph');},
      onSnapshot: value => { if (project()?.id === snapshot.project.id) applySnapshot(value); },
      onUpload: () => { document.getElementById('mxf-dialog')?.close(); handlers['lw-upload-open']({dataset:{kind:'design'}}); },
      onOpenDocument: (id, locator) => handlers['lw-document']({dataset:{id, locator}}),
      onOpenCase: id => handlers['lw-case-open']({dataset:{id}})
    }));
    return window.MXZFacility.template(snapshot);
  }
  const legalLabels = { all: '全部引用', updated: '引用版本已有变化', partial_update: '部分条款衔接', related_update: '新国标衔接', citation_conflict: '引用名称 / 编号疑点', unverified: '待官方核验', version_missing: '版本未标明', aligned: '与登记一致', upcoming: '新版待施行', recheck_due: '核验到期', repealed: '废止记录' };
  const legalReview = () => local.snapshot?.legalReview;
  function legalAttention() { const c = legalReview()?.counts || {}; return ['updated','partial_update','related_update','citation_conflict','repealed','recheck_due'].reduce((n,k) => n + (c[k] || 0), 0); }
  function officialLink(url, label = '官方依据 ↗') { return /^https:\/\//.test(url || '') ? `<a class="lw-text-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : '<small>官方依据待补</small>'; }
  function legalIntakePanel() {
    const r = legalReview(); if (!r?.total) return '';
    const highlightRank = x => /3034/.test(x.citedVersion) ? 0 : /30871/.test(x.citedVersion) ? 1 : x.title === '中华人民共和国安全生产法' ? 2 : 3;
    const changed = (r.references || []).filter(x => ['updated','partial_update','related_update','citation_conflict','repealed'].includes(x.status)).sort((a,b) => highlightRank(a)-highlightRank(b));
    const hidden = local.snapshot?.intake?.hidden || [];
    const names = {scene:'今日现场', reporting:'监管上报', duties:'履职展板', archives:'档案展示', graph:'关系图谱', facility:'动态沙盘'};
    return `<section class="card lw-panel lw-intake-panel"><header><div><span class="lw-kicker">上传后的资料内检</span><h2>从企业资料，找到下一步</h2><p class="lw-muted">企业事实与原文独立展示，任务关联可以逐步建立。</p></div><a class="secondary-btn" href="#regulations">查看法规版本核对 →</a></header><div class="lw-intake-steps"><div><b>${docs().length}</b><span>原件已保存</span></div><i>→</i><div><b>${r.total}</b><span>引用候选已整理</span></div><i>→</i><div class="attention"><b>${legalAttention()}</b><span>版本 / 衔接待核</span></div><i>→</i><div><b>${r.baseline?.included?.length || 0}</b><span>行业与区域候选依据</span></div></div>${changed.length ? `<div class="lw-legal-highlights">${changed.slice(0,3).map(x => `<article><span>${tag(x.statusLabel,'pending')}</span><strong>${esc(x.title)}</strong><small>${esc(x.citedVersion)} → ${esc(x.currentVersion || '原文核对')}</small></article>`).join('')}</div>` : ''}<p class="lw-muted">核验登记日期 ${esc(r.verifiedOn)} · 其余未知引用保留待核，不默认有效。${r.sourceDocuments?.some(d => d.partial || d.status !== 'parsed') ? ' 本次仅核对已读取的文本，未覆盖图纸内文字或尚未解析的内容。' : ''}${hidden.length ? `待接入实际数据：${hidden.map(h => names[h.name] || h.name).map(esc).join('、')}；完整功能演示仍保留。` : ''}</p></section>`;
  }
  function referenceResults() {
    const r = legalReview();
    const query = local.legalQuery.trim().toLowerCase();
    const items = (r?.references || []).filter(x => (local.legalFilter === 'all' || x.status === local.legalFilter) && [x.title,x.citedVersion,x.currentTitle,x.currentVersion,x.reason].join(' ').toLowerCase().includes(query));
    const pages = Math.max(1, Math.ceil(items.length / 15)); local.legalPage = Math.min(local.legalPage, pages - 1);
    const page = items.slice(local.legalPage * 15, (local.legalPage + 1) * 15);
    return `<div class="lw-legal-result-count" role="status">匹配 ${items.length} 项 · 每页 15 项 · 引用按编号与版本去重，保留重复出现的位置</div><div class="lw-legal-reference-list">${page.map(x => `<article class="lw-legal-reference"><div class="lw-legal-reference-top"><div><h3>${esc(x.title)}</h3><span class="lw-legal-version">原文引用：${esc(x.citedVersion)}</span></div>${tag(x.statusLabel, x.status === 'aligned' ? 'saved' : 'pending')}</div><div class="lw-legal-comparison"><span>官方登记 / 衔接依据</span><strong>${esc(x.currentVersion || '尚未完成官方核验')}</strong>${x.currentTitle && x.currentTitle !== x.title ? `<small>${esc(x.currentTitle)}</small>` : ''}</div><p>${esc(x.reason)}</p>${x.note ? `<details class="lw-legal-note"><summary>查看核验说明</summary><p>${esc(x.note)}</p></details>` : ''}<div class="lw-legal-reference-meta">${officialLink(x.officialUrl)}<small>${x.verifiedOn ? `核验 ${esc(x.verifiedOn)}` : '待核队列'}${x.effectiveFrom ? ` · 施行 ${esc(x.effectiveFrom)}` : ''} · 原文出现 ${x.occurrences} 次</small></div>${designEvidence(x.evidence)}</article>`).join('') || '<div class="lw-inline-empty">没有匹配的引用候选。未提取到引用不表示没有适用法规。</div>'}</div><div class="lw-segment-pagination">${button('上一页','lw-legal-page',`data-page="${Math.max(0,local.legalPage-1)}" ${local.legalPage === 0 ? 'disabled' : ''}`,true)}<span>第 ${local.legalPage+1} / ${pages} 页</span>${button('下一页','lw-legal-page',`data-page="${local.legalPage+1}" ${local.legalPage+1 >= pages ? 'disabled' : ''}`,true)}</div>`;
  }
  function refreshLegalResults() { const root = document.getElementById('lw-legal-results'); if (root) root.innerHTML = referenceResults(); }
  function libraryRows() {
    const query = local.libraryQuery.toLowerCase();
    const sources = (legalReview()?.baseline?.included || []).filter(s => [s.title,s.currentVersion,s.condition,s.note].join(' ').toLowerCase().includes(query));
    return sources.map(s => `<tr><td>${esc(s.title)}<small>${esc(s.currentVersion)}</small></td><td>${tag(s.applicationLabel,'pending')}<small>${esc(s.condition)}</small></td><td><small>${esc(s.reason)}${s.origin === 'source_seed' ? '；既有来源登记，持续效力仍需复核' : '；官方元数据 / 公告已登记'}</small>${s.note ? `<details class="lw-legal-note"><summary>核验说明</summary><p>${esc(s.note)}</p></details>` : ''}</td><td>${officialLink(s.officialUrl)}<small>${esc(s.verifiedOn || '日期待核')}</small></td></tr>`).join('') || '<tr><td colspan="4">没有匹配条目。候选库仍在补充，不能据此认定不存在适用要求。</td></tr>';
  }
  function regulationsPageLocal() {
    const r = legalReview(), excluded = r?.baseline?.excluded || [];
    return `${title('法规与监管资料', `${project().industry} · ${project().city} · 从原文引用开始，核对版本与适用条件。`)}${legalIntakePanel()}<section class="card lw-panel"><header><div><h2>专篇与资料引用 · 版本核对</h2><p class="lw-muted">旧设计依据保留原样；当前运行要求另行核实。</p></div>${button('重新对照已核验库','lw-legal-refresh','',true)}</header><div class="lw-legal-controls">${field('搜索引用名称、编号或新版', input('legalQuery',local.legalQuery,'search','id="lw-legal-search" placeholder="例如：3034、重大危险源、消防"'))}${field('核验状态',`<select id="lw-legal-filter">${Object.entries(legalLabels).filter(([k]) => k === 'all' || r?.counts?.[k]).map(([k,v]) => `<option value="${k}" ${selected(k,local.legalFilter)}>${v}${k === 'all' ? '' : `（${r.counts[k]}）`}</option>`).join('')}</select>`)}</div><div id="lw-legal-results">${referenceResults()}</div><p class="lw-boundary">${esc(r?.boundary || '上传资料后会自动提取可读取的引用文字。')}</p></section><section class="card lw-panel"><header><div><h2>本企业行业与区域候选库 · ${r?.baseline?.included?.length || 0} 项</h2><p class="lw-muted">先看行业和属地，再核对装置、工艺、物料及实际状态；候选不等于全部适用。</p></div>${tag('逐项确认适用条件','pending')}</header>${field('搜索本企业候选依据',input('libraryQuery',local.libraryQuery,'search','id="lw-library-search" placeholder="例如：储罐、特种设备、培训"'))}<div class="data-table-wrap"><table class="data-table"><thead><tr><th>名称 / 版本</th><th>适用条件</th><th>收录原因与核验说明</th><th>官方来源</th></tr></thead><tbody id="lw-library-rows">${libraryRows()}</tbody></table></div>${excluded.length ? `<details class="lw-legal-note"><summary>另有 ${excluded.length} 项因行业或地域不匹配，未列入本企业候选</summary>${excluded.map(s => `<p>${esc(s.title)} — ${esc(s.reason)}</p>`).join('')}</details>` : ''}</section><section class="card lw-panel"><header><h2>企业实际收到的政府文件</h2>${button('补充文件','lw-upload-open','data-kind="regulatory"',true)}</header>${docRows(docs().filter(d => d.kind === 'regulatory'))}<div class="lw-boundary">当年自治区、${esc(project().city)}及企业实际所属旗县、园区监管文件仍需补充。保存文件、判定适用、落实任务分别留证。</div></section>`;
  }
  const routeMap = { facility: facilityPageLocal, home: homePage, enterprise: enterprisePageLocal, duties: dutiesPageLocal, archives: archivesPageLocal, graph: graphPageLocal, regulations: regulationsPageLocal, reporting: basePages.reporting, scene: basePages.scene };
  function activateRoutes() { window.workspacePages = local.mode === 'local' ? Object.fromEntries(Object.entries(routeMap).map(([key, fn]) => [key, () => guarded(key, fn)])) : { ...basePages, facility: () => `${title('企业动态沙盘', '从设计专篇或环评建立厂区，集中监督承包商与作业票。')}<section class="lw-unconnected card"><h2>在本地工作空间使用动态沙盘</h2><p>从已上传设计专篇或环评整理企业建设单元，再按装置登记承包商、作业票与人数。</p>${button('进入本地动态沙盘', 'lw-facility-local')}</section>` }; }
  function goto(page, anchor) { if (location.hash !== `#${page}`) location.hash = page; else redraw(); if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40); }
  function captureDraft() {
    const f = document.getElementById('lw-case-form'); if (!f) return local.draft;
    const val = name => f.elements.namedItem(name)?.value || '';
    const d = { ...editorData(), applicability: val('applicability'), applicabilityNote: val('applicabilityNote'), procedureNumber: val('procedureNumber').trim(), version: val('version').trim(), effectiveDate: val('effectiveDate'), inUse: triParse(val('inUse')), procedureDocumentId: val('procedureDocumentId'), procedureLocator: val('procedureLocator'), policyDocumentId: val('policyDocumentId'), policyLocator: val('policyLocator'), rosterDocumentId: val('rosterDocumentId'), rosterLocator: val('rosterLocator'), requirementConfirmed: f.elements.namedItem('requirementConfirmed').checked, beforeUseRequired: triParse(val('beforeUseRequired')), assessmentRequired: triParse(val('assessmentRequired')), businessStatus: val('businessStatus'), notes: val('notes'), people: [...f.querySelectorAll('[data-person-row]')].map(row => ({ id: row.querySelector('[name=personId]').value.trim(), name: row.querySelector('[name=personName]').value.trim() })), training: [...f.querySelectorAll('[data-training-row]')].map(row => ({ id: row.querySelector('[name=trainingId]').value, personId: row.querySelector('[name=trainingPerson]').value, version: row.querySelector('[name=trainingVersion]').value.trim(), date: row.querySelector('[name=trainingDate]').value, passed: triParse(row.querySelector('[name=trainingPassed]').value), documentId: row.querySelector('[name=trainingDocument]').value, locator: row.querySelector('[name=trainingLocator]').value })), coverage: { status: val('coverageStatus'), from: val('coverageFrom'), to: val('coverageTo'), note: val('coverageNote'), sourceDocumentIds: [...f.querySelectorAll('[name=coverageDocument]:checked')].map(x => x.value) } };
    local.draft = d; return d;
  }
  function validateDraft(d) {
    const ids = new Set();
    for (const p of d.people) { if (!p.id || !p.name) throw new Error('请为每名受影响人员填写稳定编号与姓名。'); if (ids.has(p.id)) throw new Error(`人员编号 ${p.id} 重复，请核对。`); ids.add(p.id); }
    for (const t of d.training) { if (!t.personId || !ids.has(t.personId)) throw new Error('培训记录需对应当前名单中的稳定人员编号。'); if (!t.version || !t.date || !t.documentId || !t.locator) throw new Error('每条培训记录需填写版本、日期、原件及内容位置；尚无记录时可移除此空行后保存。'); }
    if (d.coverage.status === 'complete' && (!d.coverage.from || !d.coverage.to || !d.coverage.note.trim() || !d.coverage.sourceDocumentIds.length)) throw new Error('声明资料范围完整时，请补充起止日期、来源资料和范围说明。');
    return d;
  }
  function override(name, fn) { originalHandlers[name] = handlers[name]; handlers[name] = el => local.mode === 'local' ? fn(el) : originalHandlers[name]?.(el); }
  override('enterprise', () => handlers['lw-project-switch']());
  override('upload', el => handlers['lw-upload-open'](el));
  override('notifications', () => { local.pageViews.home = 'live'; goto('home'); local.feedback = `当前有 ${allFindings().length} 条工作关联提示、${designReview()?.findings?.length || 0} 条专篇待核事项，可在首页查看。`; redraw(); });
  override('guide', () => showModal('完整演示与企业资料使用指南', '<p>左侧保留全部演示功能。首页、履职、档案可查看完整功能演示；企业资料、法规核验和建设沙盘保留实际内容。页面内可切换“完整功能演示 / 虚构企业样本”，示例数据不会写入企业台账。</p><p>① 创建企业并上传原件；② 打开原件核对提取内容；③ 新建规程变更工作，填写依据、受影响人员、培训及资料覆盖；④ 保存并查看关联结果、档案与历史。</p><p>当前为本机单用户。真实资料分析在 AI 未配置时使用本地文本提取及规则核对；首页智能交互保留示例回答，并标记为演示。</p>'));
  Object.assign(handlers, {
    'lw-legal-page': el => { local.legalPage = Math.max(0, Number(el.dataset.page) || 0); refreshLegalResults(); document.getElementById('lw-legal-results')?.scrollIntoView({behavior:'smooth',block:'start'}); },
    'lw-legal-refresh': async el => { const pid = project().id; el.disabled = true; try { const result = await request('/api/library'); if (project()?.id !== pid) return; local.library = result; await refreshProject(pid, false); if (project()?.id !== pid) return; local.feedback = '已按当前原文和已核验库重新对照。未进行全库联网检索，未知条目继续待核。'; redraw(); } catch(e) { displayError(e); } },
    'lw-page-view': el => { const page = el.dataset.page, view = el.dataset.view; if (!Object.hasOwn(routeMap,page) || !['demo','live'].includes(view)) return; captureDraft(); local.pageViews[page] = view; goto(page); redraw(); },
    'lw-design-review': () => { captureDraft(); local.pageViews.enterprise = 'live'; goto('enterprise', 'lw-design-review'); },
    'lw-facility-local': () => { local.mode = 'local'; activateRoutes(); goto('facility'); redraw(); },
    'lw-dismiss': () => { local.error = ''; local.feedback = ''; redraw(); },
    'lw-toggle': () => { if (local.mode === 'local') captureDraft(); local.mode = local.mode === 'local' ? 'demo' : 'local'; activateRoutes(); redraw(); if (local.mode === 'demo') render(); updateChrome(); },
    'lw-demo-page': el => { local.mode = 'demo'; activateRoutes(); goto(el.dataset.page); render(); updateChrome(); },
    'lw-project-switch': () => showModal('企业工作空间', `<div class="lw-project-choices">${local.projects.map(p => `<button type="button" data-action="lw-project-select" data-id="${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc(p.city)} · ${esc(p.site)}</small></button>`).join('')}</div>${button('加载独立的虚构体验样本', 'lw-example', '', true)}${projectForm()}`),
    'lw-example': async el => { if (el) el.disabled = true; try { const r = await request('/api/examples', { method: 'POST', body: {} }); if (!local.projects.some(p => p.id === r.project.id)) local.projects.push(r.project); local.selectedCase = ''; local.draft = null; local.selectedDocument = ''; local.documentDetail = null; applySnapshot(r.snapshot, true); try { localStorage.setItem('mxz.localProject', r.project.id); } catch {} if (modal.open) closeModal(); local.feedback = '独立的虚构体验企业已保存。样本原件可查看；补齐对应人员记录后可以重新核对。'; goto('home'); redraw(); } catch (e) { displayError(e); } finally { if (el?.isConnected) el.disabled = false; } },
    'lw-project-select': async el => { try { local.error = ''; local.feedback = ''; local.selectedDocument = ''; local.documentDetail = null; local.selectedCase = ''; local.draft = null; await refreshProject(el.dataset.id); closeModal(); goto('home'); redraw(); } catch (e) { displayError(e); } },
    'lw-upload-open': el => { captureDraft(); local.pageViews.enterprise = 'live'; goto('enterprise', 'lw-upload-panel'); setTimeout(() => { const s = document.getElementById('lw-upload-kind'); if (s && el?.dataset?.kind) s.value = el.dataset.kind; }, 60); },
    'lw-document': async el => { local.pageViews.enterprise = 'live'; const pid = project().id; try { captureDraft(); local.selectedDocument = el.dataset.id; local.documentLocator = el.dataset.locator || ''; local.documentQuery = ''; local.documentPage = 0; local.documentDetail = null; const result = await request(projectPath(pid, `/documents/${encodeURIComponent(el.dataset.id)}`)); if (project()?.id !== pid || local.selectedDocument !== el.dataset.id) return; local.documentDetail = result.document; goto('enterprise', local.documentLocator ? 'lw-document-focus' : 'lw-document-detail'); } catch (e) { if (project()?.id === pid) displayError(e); } },
    'lw-segment-page': el => { local.documentPage = Math.max(0, Number(el.dataset.page) || 0); refreshDocumentResults(); document.getElementById('lw-document-search')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    'lw-segment-focus': el => { local.documentLocator = el.dataset.locator || ''; const d = local.documentDetail || docs().find(x => x.id === local.selectedDocument), focus = document.getElementById('lw-document-focus'); if (d && focus) { focus.innerHTML = documentFocusPanel(d); refreshDocumentResults(); focus.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
    'lw-document-query-clear': () => { local.documentQuery = ''; local.documentPage = 0; const input = document.getElementById('lw-document-query'); if (input) { input.value = ''; input.focus(); } refreshDocumentResults(); },
    'lw-reparse': async el => { const pid = project().id; el.disabled = true; el.textContent = '重新提取中…'; try { const result = await request(projectPath(pid, `/documents/${encodeURIComponent(el.dataset.id)}/reparse`), { method: 'POST' }); if (project()?.id !== pid) return; applySnapshot(result.snapshot); local.documentDetail = result.document; local.feedback = '原件内容已重新提取，请查看提取状态和关联变化。'; redraw(); } catch (e) { if (project()?.id === pid) displayError(e); } },
    'lw-analyze': async el => { const pid = project().id; el.disabled = true; el.textContent = '正在分析…'; try { const result = await request(projectPath(pid, `/documents/${encodeURIComponent(el.dataset.id)}/analyze`), { method: 'POST' }); if (project()?.id !== pid) return; applySnapshot(result.snapshot); local.documentDetail = result.document; local.feedback = '分析结果已保存为候选，请结合原件核对。'; redraw(); } catch (e) { if (project()?.id === pid) displayError(e); } },
    'lw-case-new': () => { local.pageViews.duties = 'live'; return showModal('新建规程变更工作', `<form id="lw-case-new-form">${field('工作名称', input('title', '', 'text', 'required maxlength="160" placeholder="例如：卸料操作规程 V3 修订"'))}<p class="lw-muted">先保存空白工作，再补充并核对制度、规程、受影响人员和培训。未知条件会保持待核实。</p><button type="submit" class="primary-btn">创建工作记录</button></form>`); },
    'lw-case-open': el => { local.pageViews.duties = 'live'; captureDraft(); local.selectedCase = el.dataset.id; local.draft = structuredClone(currentCase()?.data || blankData()); local.dirty = false; goto('duties'); redraw(); },
    'lw-person-add': () => { captureDraft(); local.draft.people.push({ id: '', name: '' }); local.dirty = true; redraw(); },
    'lw-person-remove': el => { captureDraft(); const id = local.draft.people[Number(el.dataset.index)]?.id; if (id && local.draft.training.some(t => t.personId === id)) { local.error = '该人员仍有关联培训记录，请先移除或调整对应培训记录。'; redraw(); return; } local.draft.people.splice(Number(el.dataset.index), 1); local.dirty = true; redraw(); },
    'lw-training-add': () => { captureDraft(); local.draft.training.push({ id: crypto.randomUUID(), personId: '', version: local.draft.version, date: '', passed: null, documentId: '', locator: '' }); local.dirty = true; redraw(); },
    'lw-training-remove': el => { captureDraft(); local.draft.training.splice(Number(el.dataset.index), 1); local.dirty = true; redraw(); },
    'lw-archive-element': el => { local.archiveElement = el.dataset.element; redraw(); setTimeout(() => document.getElementById('lw-archive-detail')?.scrollIntoView({ behavior: 'smooth' }), 20); },
    'lw-graph-expand': () => { local.graphExpanded = !local.graphExpanded; redraw(); }
  });
  document.addEventListener('submit', async event => {
    if (local.mode !== 'local' || !event.target.id.startsWith('lw-')) return;
    event.preventDefault();
    const form = event.target, submit = form.querySelector('[type=submit]');
    if (submit) submit.disabled = true;
    local.error = ''; local.feedback = '';
    try {
      if (form.id === 'lw-project-form') {
        const body = Object.fromEntries(new FormData(form));
        for (const k of ['name','site']) body[k] = body[k].trim();
        if (!body.name || !body.site) throw new Error('请填写企业名称与实际场所。');
        const r = await request('/api/projects', { method: 'POST', body }); local.projects.push(r.project); local.selectedCase = ''; local.draft = null; local.selectedDocument = ''; local.documentDetail = null; await refreshProject(r.project.id); if (modal.open) closeModal(); local.feedback = '企业工作空间已创建并保存。可以开始添加原件。'; goto('enterprise');
      } else if (form.id === 'lw-case-new-form') {
        const title = new FormData(form).get('title').trim(); if (!title) throw new Error('请填写工作名称。');
        const before = new Set(cases().map(c => c.id)); const r = await request(apiPath('/cases'), { method: 'POST', body: { title } }); applySnapshot(r, true); local.selectedCase = cases().find(c => !before.has(c.id))?.id || currentCase()?.id; local.draft = structuredClone(currentCase()?.data || blankData()); closeModal(); local.feedback = '工作记录已保存，未知条件保持待核实。'; goto('duties');
      } else if (form.id === 'lw-upload-form') {
        local.uploading = true;
        const uploadProjectId = project().id;
        const files = [...form.querySelector('[name=files]').files]; if (!files.length) throw new Error('请先选择资料文件。');
        const max = local.capabilities.maxUploadBytes; if (max && files.some(f => f.size > max)) throw new Error(`单份资料不可超过 ${(max / 1024 / 1024).toFixed(0)} MB，请调整后重新选择。`);
        const kind = form.querySelector('[name=kind]').value;
        let saved = 0, duplicate = 0; const failures = [];
        for (let i = 0; i < files.length; i++) {
          const progress = document.getElementById('lw-upload-progress'); if (progress) progress.textContent = `正在处理 ${i+1}/${files.length}：${files[i].name}`;
          const body = new FormData(); body.append('file', files[i]); body.append('kind', kind);
          try { const r = await request(projectPath(uploadProjectId, '/documents'), { method: 'POST', body }); if (project()?.id === uploadProjectId) applySnapshot(r.snapshot); r.duplicate ? duplicate++ : saved++; } catch (e) { failures.push(`${files[i].name}：${e.message}`); }
        }
        local.uploading = false; local.feedback = `已保存 ${saved} 份新原件${duplicate ? `，${duplicate} 份重复文件未重复保存` : ''}。已自动整理可读取的法规引用并对照核验库，请查看提取状态与内检结果。`; if (failures.length) local.error = failures.join('；');
      } else if (form.id === 'lw-case-form') {
        const data = validateDraft(captureDraft()); const caseId = currentCase().id; const saveProjectId = project().id;
        try { const r = await request(projectPath(saveProjectId, `/cases/${encodeURIComponent(caseId)}`), { method: 'PUT', body: { expectedRevision: Number(form.dataset.revision), data } }); if (project()?.id !== saveProjectId) return; applySnapshot(r, true); local.feedback = '事实与核对结果已保存。任务、档案和图谱已使用同一份新结果。'; redraw(); setTimeout(() => document.getElementById('lw-evaluation')?.scrollIntoView({ behavior: 'smooth' }), 30); return; }
        catch (e) { if (project()?.id !== saveProjectId) return; if (e.status === 409) { const draft = structuredClone(data); await refreshProject(saveProjectId, true); local.draft = draft; local.dirty = true; throw new Error('该工作已在其他页面更新。已读取最新版本，保留本页编辑供核对；请检查后再次保存，避免覆盖他人修改。'); } throw e; }
      }
      redraw();
    } catch (e) { local.uploading = false; if (modal.open && (form.id === 'lw-project-form' || form.id === 'lw-case-new-form')) { let err = form.querySelector('.lw-form-error'); if (!err) { err = document.createElement('p'); err.className = 'lw-form-error'; err.setAttribute('role','alert'); form.append(err); } err.textContent = e.message; } else displayError(e); }
    finally { if (submit?.isConnected) submit.disabled = false; }
  });
  document.addEventListener('input', e => { if (local.mode === 'local' && e.target.id === 'lw-legal-search') { local.legalQuery = e.target.value; local.legalPage = 0; refreshLegalResults(); } if (local.mode === 'local' && e.target.id === 'lw-document-query') { local.documentQuery = e.target.value; local.documentPage = 0; refreshDocumentResults(); } if (local.mode === 'local' && e.target.id === 'lw-library-search') { local.libraryQuery = e.target.value; document.getElementById('lw-library-rows').innerHTML = libraryRows(); } if (local.mode === 'local' && e.target.closest('#lw-case-form')) { local.dirty = true; captureDraft(); } });
  document.addEventListener('change', e => {
    if (local.mode !== 'local') return;
    if (e.target.id === 'lw-legal-filter') { local.legalFilter = e.target.value; local.legalPage = 0; refreshLegalResults(); }
    if (e.target.id === 'lw-case-select') { captureDraft(); local.selectedCase = e.target.value; local.draft = structuredClone(currentCase()?.data || blankData()); local.dirty = false; redraw(); }
    if (e.target.dataset.lwSource) { captureDraft(); const prefix = e.target.dataset.lwSource; local.draft[`${prefix}Locator`] = ''; local.dirty = true; redraw(); }
    if (e.target.dataset.lwTrainingSource !== undefined) { captureDraft(); local.draft.training[Number(e.target.dataset.lwTrainingSource)].locator = ''; local.dirty = true; redraw(); }
  });
  document.addEventListener('keydown', e => { if (local.mode === 'local' && (e.key === 'Enter' || e.key === ' ') && e.target.matches('.lw-graph-node[data-action]')) { e.preventDefault(); handlers[e.target.dataset.action]?.(e.target); } });
  window.addEventListener('hashchange', updateChrome);
  window.addEventListener('beforeunload', e => { if (local.mode === 'local' && local.dirty) { e.preventDefault(); e.returnValue = ''; } });
  async function start() {
    activateRoutes(); render(); updateChrome();
    try {
      const b = await request('/api/bootstrap'); local.csrf = b.csrfToken; local.projects = b.projects || []; local.capabilities = b.capabilities || {};
      const resources = await Promise.allSettled([request('/api/system'), request('/api/library')]);
      local.system = resources[0].status === 'fulfilled' ? resources[0].value : null;
      local.library = resources[1].status === 'fulfilled' ? resources[1].value : null;
      let preferred; try { preferred = localStorage.getItem('mxz.localProject'); } catch {}
      const p = local.projects.find(p => p.id === preferred) || local.projects[0]; if (p) await refreshProject(p.id);
    } catch (e) { local.error = `演示资料读取失败：${e.message}。请通过本地服务地址打开工作台。`; }
    local.ready = true; redraw();
  }
  start();
})();
