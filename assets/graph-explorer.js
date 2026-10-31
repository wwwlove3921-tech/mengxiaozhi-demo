/* Interactive evidence explorer. Rendering changes never modify business facts. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const statusNames = { gap: '关联缺口', historical: '历史问题', pending: '待核实', review_pending: '专篇待核（非违规结论）', complete: '本次材料齐备', normal: '已关联', not_applicable: '已确认不适用' };
  const kinds = { project: '企业', case: '工作', policy: '制度', procedure: '规程', roster: '名单', coverage: '覆盖范围', person: '人员', training: '培训', document: '原件', requirement: '要求', version: '版本', finding: '检查结果', historical: '历史问题', archive: '档案要素', evidence: '原文位置', design_review: '专篇初评', design_fact: '设计原文描述', facility_unit: '建设单元', design_finding: '原文待核事项', standard_reference: '原文规范引用', material_request: '运行资料请求' };
  const svg = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({ search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>', globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>', fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', play: '<path d="m9 5 11 7-11 7Z"/>', pause: '<path d="M9 5v14M15 5v14"/>', expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/>', link: '<path d="M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2m3 5a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2"/>', arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>' })[name] || ''}</svg>`;
  const tool = (name, title, extra = '') => `<button type="button" data-mxg="${name}" title="${title}" aria-label="${title}" ${extra}>${svg(name)}</button>`;
  let current = null, vendorPromise = null;
  const preferences = { projectId: '', scope: 'all', caseId: '', mode: '3d', status: 'all', query: '', motion: !matchMedia('(prefers-reduced-motion: reduce)').matches };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function loadVendor() {
    if (window.MXZGraphLib) return Promise.resolve(window.MXZGraphLib);
    if (!vendorPromise) vendorPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'assets/vendor/graph-vendor.js'; script.async = true;
      script.onload = () => resolve(window.MXZGraphLib); script.onerror = () => { vendorPromise = null; script.remove(); reject(new Error('图谱引擎未加载，请刷新重试。')); };
      document.head.append(script);
    });
    return vendorPromise;
  }
  function template(snapshot) {
    const groups = window.MXZGraphModel.build(snapshot).groups;
    const count = groups.length;
    return `<section class="mxg-app" id="mxg-explorer" aria-label="交互式合规证据网络">
      <header class="mxg-heading"><div><div class="mxg-eyebrow">CONNECTED WORKSPACE <span>合规证据网络</span></div><h1>看见每一项工作的关联<span class="mxg-heading-dot"></span></h1><p>从专篇与建设范围，到工作、人员与原件。悬停看关联，点击读证据。</p></div><div class="mxg-project-chip"><span></span>${escape(snapshot.project?.name)}<small>本地资料</small></div></header>
      <div class="mxg-toolbar"><label class="mxg-search">${svg('search')}<input type="search" id="mxg-search" aria-label="搜索图谱节点" placeholder="查找建设单元、工作或证据…" autocomplete="off"><kbd>/</kbd></label><label class="mxg-scope"><span class="mxg-sr-only">关联范围</span><select id="mxg-scope"><option value="all">全部关联组 · ${count}</option>${groups.map(g => `<option value="${escape(g.id)}">${escape(g.label)}</option>`).join('')}</select></label><div class="mxg-segment" aria-label="关系筛选"><button data-mxg="all" aria-pressed="true">全部关联</button><button data-mxg="issues" aria-pressed="false"><span class="mxg-red-dot"></span>需要关注</button></div><div class="mxg-view-switch" aria-label="视图模式"><button data-mxg="3d" aria-pressed="true">${svg('globe',16)}3D 球面</button><button data-mxg="2d" aria-pressed="false">2D 关系</button></div></div>
      <div class="mxg-shell"><div class="mxg-stage-wrap"><div class="mxg-stage-top"><span class="mxg-scene-title">COMPLIANCE GRAPH <b>关系探索</b></span><span id="mxg-metric">正在展开证据网络…</span></div><div class="mxg-search-results" id="mxg-search-results" hidden></div><div class="mxg-stage" id="mxg-stage" tabindex="0" role="group" aria-label="可旋转、拖动与缩放的关系图。也可使用右侧节点清单操作。"><div class="mxg-loading"><span class="mxg-loading-orbit"></span><b>正在展开证据网络</b><small>任务、人员与原件将在这里相遇</small></div></div><div class="mxg-stage-tools">${tool('fit','回到全景')}${tool('plus','放大')}${tool('minus','缩小')}<span></span><button data-mxg="motion" id="mxg-motion" title="暂停自动动效" aria-label="暂停自动动效">${svg('pause')}</button>${tool('expand','展开图谱工作区')}${tool('help','查看操作说明')}</div><div class="mxg-live-caption" id="mxg-caption" aria-live="polite">拖动空白处旋转 · 滚轮缩放 · 拖动节点重新排列</div><div class="mxg-help" hidden><b>像探索笔记一样，探索工作</b><p>空白处拖动：旋转视角<br>节点拖动：调整位置与布局<br>滚轮 / 双指：缩放<br>悬停：突出相邻关系<br>点击节点：聚焦并查看证据<br>右键拖动：平移视角</p><p>键盘：方向键移动视角，＋ / －缩放，0 回到全景。节点也可从右侧清单选择。</p><small>同一工作或专篇初评使用同色。红色表示需要关注，包含专篇原文待核事项、关联缺口或历史问题；专篇红色节点不代表违规结论。黄色表示资料待补或条件待核。</small></div><div class="mxg-empty-view" hidden></div><footer class="mxg-legend" id="mxg-legend"></footer></div><aside class="mxg-inspector" aria-label="节点详情与可操作清单"><div id="mxg-detail"></div><div class="mxg-node-browser"><header><h3>关联节点</h3><span id="mxg-list-count"></span></header><div id="mxg-node-list" class="mxg-node-list"></div></div></aside></div><div class="mxg-footnote"><span>${svg('link',14)}同一原件可以关联多项工作，保留唯一来源。</span><span>关联齐备 ≠ 企业全部合规 · 历史问题持续保留</span></div></section>`;
  }
  class Explorer {
    constructor(root, options) {
      this.root = root; this.options = options; this.snapshot = options.snapshot; this.stage = root.querySelector('#mxg-stage');
      this.graph = null; this.destroyed = false; this.resources = new Set(); this.hover = null; this.selected = null; this.highlight = new Set(); this.abort = new AbortController(); this.switchVersion = 0;
      if (preferences.projectId !== this.snapshot.project?.id) Object.assign(preferences, { projectId: this.snapshot.project?.id, scope: 'all', caseId: '', status: 'all', query: '' });
      this.state = { ...preferences }; this.pendingFocusId=options.focusFindingId||'';
      if(options.focusFindingId)Object.assign(this.state,{scope:'all',caseId:'',status:'all',query:''});
      if (!window.MXZGraphModel.build(this.snapshot).groups.some(g => g.id === this.state.caseId)) { this.state.scope = 'all'; this.state.caseId = ''; }
      this.bind(); this.updateModel(); this.overview(); this.init().then(()=>{if(this.destroyed)return;const n=this.model.nodes.find(n=>n.findingId===this.options.focusFindingId);if(n)this.select(n);this.options.onFocusConsumed?.();});
    }
    $(selector) { return this.root.querySelector(selector); }
    listen(el, name, fn) { el.addEventListener(name, fn, { signal: this.abort.signal }); }
    savePreferences() { Object.assign(preferences, this.state); }
    bind() {
      this.$('#mxg-search').value = this.state.query; this.$('#mxg-scope').value = this.state.scope === 'case' ? this.state.caseId : 'all';
      this.listen(this.root, 'click', event => {
        const nodeButton = event.target.closest('[data-mxg-node]'); if (nodeButton) { this.select(this.model.nodes.find(n => n.id === nodeButton.dataset.mxgNode)); return; }
        const button = event.target.closest('[data-mxg]'); if (!button) return; const action = button.dataset.mxg;
        if (['all','issues'].includes(action)) { this.state.status = action; this.updateModel(); this.replot(); this.overview(); }
        else if (action === '3d' || action === '2d') { if (this.state.mode !== action) { this.state.mode = action; this.init(); } }
        else if (action === 'fit') { this.selected = null; this.hover = null; this.updateHighlight(); this.overview(); this.fit(); }
        else if (action === 'plus' || action === 'minus') this.zoom(action === 'plus' ? 1.2 : 1/1.2);
        else if (action === 'motion') { this.state.motion = !this.state.motion; this.motion(); }
        else if (action === 'expand') { this.root.classList.toggle('mxg-expanded'); button.setAttribute('aria-label', this.root.classList.contains('mxg-expanded') ? '恢复工作区尺寸' : '展开图谱工作区'); this.resize(); }
        else if (action === 'help') this.$('.mxg-help').hidden = !this.$('.mxg-help').hidden;
        else if (action === 'document' && this.selected?.documentId) this.options.onOpenDocument(this.selected.documentId, this.selected.locator);
        else if (action === 'facility' && this.selected?.separationId) this.options.onOpenFacility?.(this.selected.separationId);
        else if (action === 'case' && this.selected?.caseId) this.options.onOpenCase(this.selected.caseId);
        this.savePreferences(); this.controlsUI();
      });
      this.listen(this.$('#mxg-search'), 'input', event => { clearTimeout(this.searchTimer); this.state.query = event.target.value; this.searchTimer = setTimeout(() => { if (this.destroyed) return; this.updateModel(); this.replot(); this.overview(); this.savePreferences(); }, 160); });
      this.listen(this.$('#mxg-search'), 'keydown', event => { if (event.key === 'Enter') { const n = this.matches()[0]; if (n) this.select(n); } });
      this.listen(this.$('#mxg-scope'), 'change', event => { this.state.scope = event.target.value === 'all' ? 'all' : 'case'; this.state.caseId = event.target.value === 'all' ? '' : event.target.value; this.selected = null; this.updateModel(); this.replot(); this.overview(); this.savePreferences(); });
      this.listen(this.stage, 'pointerdown', () => { this.fitPending=false;this.pendingFocusId=''; });
      this.listen(this.stage, 'wheel', () => { this.fitPending=false;this.pendingFocusId=''; });
      this.listen(this.stage, 'keydown', event => {
        if (!this.graph) return;
        if (['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) event.preventDefault();
        if (event.key === '+' || event.key === '=') this.zoom(1.2); if (event.key === '-') this.zoom(1/1.2); if (event.key === '0') this.fit();
        if (event.key.startsWith('Arrow')) this.moveKeyboard(event.key);
      });
      this.listen(document, 'keydown', event => { if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target.closest('input,textarea,select,[contenteditable="true"]')) { event.preventDefault(); this.$('#mxg-search').focus(); } if (event.key === 'Escape' && this.root.classList.contains('mxg-expanded')) { this.root.classList.remove('mxg-expanded'); this.$('[data-mxg=expand]').setAttribute('aria-label', '展开图谱工作区'); this.resize(); } });
      this.listen(document, 'visibilitychange', () => { if (!this.graph) return; document.hidden ? this.graph.pauseAnimation() : this.graph.resumeAnimation(); });
      this.listen(reduced, 'change', () => { if (reduced.matches) { this.state.motion = false; this.motion(); this.controlsUI(); } });
      this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.stage);
      this.routeObserver = new MutationObserver(() => { if (!this.root.isConnected) this.destroy(); });
      this.routeObserver.observe(document.getElementById('page-content'), { childList: true });
    }
    updateModel() {
      this.model = window.MXZGraphModel.build(this.snapshot, this.state);
      const old = new Map((this.data?.nodes || []).map(n => [n.id, n]));
      const visible = this.model.nodes.slice(0, 500), ids = new Set(visible.map(n => n.id));
      this.data = { nodes: visible.map((n, i) => {
        const prior = old.get(n.id); const y = 1 - 2 * (i + 0.5) / Math.max(visible.length, 1); const theta = i * Math.PI * (3 - Math.sqrt(5)); const r = n.kind === 'project' ? 0 : n.kind === 'case' ? 75 : 150 + (i % 5) * 9;
        return { ...n, x: prior?.x ?? Math.sqrt(1-y*y)*Math.cos(theta)*r, y: prior?.y ?? y*r, z: prior?.z ?? Math.sqrt(1-y*y)*Math.sin(theta)*r };
      }), links: this.model.links.filter(l => ids.has(typeof l.source === 'object' ? l.source.id : l.source) && ids.has(typeof l.target === 'object' ? l.target.id : l.target)).map(l => ({ ...l })) };
      this.adjacency = new Map(this.data.nodes.map(n => [n.id, new Set([n.id])]));
      for (const l of this.data.links) { this.adjacency.get(l.source)?.add(l.target); this.adjacency.get(l.target)?.add(l.source); }
      this.$('#mxg-metric').textContent = `${this.data.nodes.length} 个节点 / ${this.data.links.length} 条关联${this.model.nodes.length > 500 ? ' · 已限制前500节点，请缩小范围' : ''}`;
      this.$('#mxg-list-count').textContent = this.model.nodes.length > 200 ? `前 200 / ${this.model.nodes.length}` : this.model.nodes.length;
      this.$('#mxg-legend').innerHTML = `${this.model.groups.slice(0,5).map(g => `<span><i style="background:${escape(g.color)}"></i>${escape(g.label).slice(0,45)}</span>`).join('')}<span><i class="issue"></i>需关注 · 含原文待核</span><span><i class="pending"></i>待核实</span>`;
      this.$('#mxg-node-list').innerHTML = this.model.nodes.slice(0,200).map(n => `<button data-mxg-node="${escape(n.id)}"><i style="background:${escape(n.color)}"></i><span>${escape(n.label)}<small>${escape(kinds[n.kind] || n.kind)}${['gap','historical','pending','review_pending'].includes(n.status) ? ' · ' + statusNames[n.status] : ''}</small></span>${svg('arrow',13)}</button>`).join('') || '<p>没有匹配的节点。调整范围或搜索词再试。</p>';
      const matches = this.matches(), results = this.$('#mxg-search-results');
      results.hidden = !this.state.query.trim(); results.innerHTML = `<small>${matches.length} 个名称或内容匹配 · 点击聚焦</small>${matches.slice(0,6).map(n => `<button data-mxg-node="${escape(n.id)}"><i style="background:${escape(n.color)}"></i>${escape(n.label)}</button>`).join('') || '<p>没有找到匹配内容</p>'}`;
      this.$('.mxg-empty-view').hidden = this.data.nodes.length > 0;
      this.$('.mxg-empty-view').innerHTML = `<b>此范围没有关联节点</b><p>${this.state.query ? '换一个关键词，或清空搜索看看。' : '上传并解析设计资料，或保存实际工作后，真实证据会在这里展开。'}</p>`;
      this.controlsUI();
    }
    matches() { const q = this.state.query.trim().toLowerCase(); return q ? this.model.nodes.filter(n => [n.label,n.detail,n.locator].join(' ').toLowerCase().includes(q)) : []; }
    controlsUI() {
      for (const b of this.root.querySelectorAll('.mxg-view-switch button')) b.setAttribute('aria-pressed', b.dataset.mxg === this.state.mode);
      for (const b of this.root.querySelectorAll('.mxg-segment button')) b.setAttribute('aria-pressed', b.dataset.mxg === this.state.status);
      const button = this.$('#mxg-motion'); button.innerHTML = svg(this.state.motion ? 'pause' : 'play'); button.setAttribute('aria-pressed', this.state.motion); button.title = this.state.motion ? '暂停自动动效，保留鼠标操作' : '开启自动动效'; button.setAttribute('aria-label', button.title);
      this.$('#mxg-caption').textContent = this.fallbackNotice || (this.state.mode === '3d' ? '拖动空白处旋转 · 滚轮缩放 · 拖动节点重新排列' : '拖动空白处平移 · 滚轮缩放 · 拖动节点探索关系');
    }
    async init() {
      const ticket = ++this.switchVersion; this.disposeGraph(); this.fallbackNotice = '';  this.stage.innerHTML = '<div class="mxg-loading"><span class="mxg-loading-orbit"></span><b>正在展开证据网络</b></div>';
      try {
        const lib = await loadVendor(); if (this.destroyed || ticket !== this.switchVersion) return;
        this.lib = lib; this.stage.innerHTML = ''; this.updateModel();
        if (this.state.mode === '3d') {
          try { this.make3D(); } catch { this.disposeGraph(); this.stage.innerHTML = ''; this.state.mode = '2d'; this.make2D(); this.fallbackNotice = '当前环境未启用3D，已切换可拖拽的2D关系视图。'; }
        } else this.make2D();
        this.motion(); this.controlsUI(); this.savePreferences(); this.resize(); this.fit(false);
      } catch (error) { if (!this.destroyed) this.stage.innerHTML = `<div class="mxg-loading"><b>${escape(error.message)}</b><small>右侧证据清单仍可查看与操作。</small></div>`; }
    }
    nodeSize(n) { return n.kind === 'project' ? 12 : ['case','design_review'].includes(n.kind) ? 9 : ['historical','finding'].includes(n.kind) ? 7 : n.kind === 'person' ? 4.8 : 5.8; }
    make3D() {
      this.graphMode = '3d'; const { ForceGraph3D, THREE } = this.lib; this.nodeObjects = new Map();
      const graph = this.graph = new ForceGraph3D(this.stage, { controlType: 'orbit', rendererConfig: { antialias: true, alpha: true } });
      graph.backgroundColor('#071a23').showNavInfo(false).nodeThreeObject(n => this.nodeObject(n)).nodeLabel(n => `<div class="mxg-tooltip"><b>${escape(n.label)}</b><span>${escape(kinds[n.kind] || '')} · ${escape(statusNames[n.status] || '已关联')}</span></div>`)
        .linkColor(l => this.linkColor(l)).linkOpacity(.5).linkWidth(l => this.linkActive(l) ? 1.15 : .35).linkCurvature(.10).linkDirectionalParticleWidth(1.1)
        .linkDirectionalParticleColor(l => l.color || '#63cbbd').linkDirectionalParticleSpeed(.0025)
        .onNodeHover(n => this.onHover(n)).onNodeClick(n => this.select(n)).onBackgroundClick(() => { this.selected = null; this.updateHighlight(); this.overview(); })
        .onNodeDrag(() => { this.state.motion = false; this.motion(); this.controlsUI(); }).onNodeDragEnd(n => { n.fx = n.x; n.fy = n.y; n.fz = n.z; this.$('#mxg-caption').textContent = '节点位置已调整 · “回到全景”恢复视角，切换视图可重新布局'; })
        .cooldownTicks(reduced.matches ? 0 : 170).d3AlphaDecay(.035).d3VelocityDecay(.42).graphData(this.data);
      graph.d3Force('charge').strength(-28); graph.d3Force('link').distance(65).strength(.15);
      let nodes = []; const sphere = alpha => nodes.forEach((n,i) => { if (n.fx !== undefined) return; const target = n.kind === 'project' ? 0 : n.kind === 'case' ? 70 : 155 + (i % 4) * 10; const length = Math.hypot(n.x,n.y,n.z) || 1; const k = (target-length)/length * .055 * alpha; n.vx += n.x*k; n.vy += n.y*k; n.vz += n.z*k; }); sphere.initialize = values => { nodes = values; }; graph.d3Force('shell', sphere);
      const controls = graph.controls(); controls.enableDamping = true; controls.dampingFactor = .075; controls.autoRotateSpeed = .55; controls.minDistance = 50; controls.maxDistance = 2200;
      this.controlStart = () => { this.state.motion = false; this.motion(); this.controlsUI(); }; controls.addEventListener('start', this.controlStart);
      graph.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      graph.lights([new THREE.AmbientLight(0xffffff, 2), new THREE.HemisphereLight(0xd9ffef, 0x1c3140, 1.7)]);
      const globe = new THREE.Group(); const material = new THREE.LineBasicMaterial({ color: '#6cabb6', transparent: true, opacity: .19, depthWrite: false }); this.resources.add(material);
      const ring = (radius,y,vertical) => { const vertices = Array.from({length:129},(_,i) => { const a=i/128*Math.PI*2; return new THREE.Vector3(Math.cos(a)*radius,vertical ? Math.sin(a)*radius : y,vertical ? 0 : Math.sin(a)*radius); }); const geometry=new THREE.BufferGeometry().setFromPoints(vertices); this.resources.add(geometry); const line=new THREE.Line(geometry,material); globe.add(line); return line; };
      for (const y of [-130,-70,0,70,130]) ring(Math.sqrt(215*215-y*y),y,false);
      for (let i=0;i<6;i++) ring(215,0,true).rotation.y=i*Math.PI/6;
      graph.scene().add(globe); this.guide = globe;
      graph.onEngineStop(()=>{if(this.pendingFocusId&&this.selected?.findingId===this.pendingFocusId&&!this.destroyed){this.pendingFocusId='';this.select(this.selected);}});graph.d3ReheatSimulation(); this.updateHighlight();
    }
    nodeObject(n) {
      const { THREE } = this.lib; const group = new THREE.Group(); const radius = this.nodeSize(n);
      const geometry = new THREE.SphereGeometry(radius,20,16); const material = new THREE.MeshStandardMaterial({ color:n.color, emissive:n.color, emissiveIntensity:.38, roughness:.3, metalness:.2, transparent:true });
      const mesh = new THREE.Mesh(geometry,material); group.add(mesh); this.resources.add(geometry); this.resources.add(material);
      const canvas=document.createElement('canvas'); const context=canvas.getContext('2d'); const label=(['gap','historical','review_pending'].includes(n.status)?'!  ':'')+(n.label.length>18?n.label.slice(0,18)+'…':n.label); context.font='500 26px system-ui, sans-serif'; canvas.width=Math.min(780,Math.ceil(context.measureText(label.slice(0,30)).width)+30); canvas.height=58;
      context.font='500 26px system-ui, sans-serif'; context.textAlign='center'; context.textBaseline='middle'; context.fillStyle=['gap','historical','review_pending'].includes(n.status)?'#ff9aa9':n.status==='pending'?'#f8d280':'#d6eaef'; context.shadowColor='#071a23';context.shadowBlur=8;context.fillText(label.slice(0,30),canvas.width/2,28);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace; const spriteMaterial=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false}); const sprite=new THREE.Sprite(spriteMaterial);sprite.scale.set(canvas.width*.36,20.9,1);sprite.position.y=-(radius+12);sprite.visible=['project','case','person','training','historical','archive','design_review','facility_unit','design_finding'].includes(n.kind);group.add(sprite); this.resources.add(texture);this.resources.add(spriteMaterial);
      const on=!this.highlight.size||this.highlight.has(n.id); material.opacity=on?1:.12; sprite.material.opacity=on?1:.12; sprite.visible=on&&(sprite.visible||this.highlight.has(n.id));
      this.nodeObjects.set(n.id,{mesh,sprite,group,kind:n.kind,resources:[geometry,material,texture,spriteMaterial]}); return group;
    }
    make2D() {
      this.graphMode = '2d'; const { ForceGraph2D } = this.lib; this.graph = new ForceGraph2D(this.stage);
      this.graph.backgroundColor('#071a23').nodeLabel(n => escape(n.label)).nodeRelSize(5).nodeVal(n=>this.nodeSize(n))
        .nodeCanvasObject((node,ctx,scale)=>{ const active=!this.highlight.size||this.highlight.has(node.id);const r=this.nodeSize(node);ctx.globalAlpha=active?1:.18;ctx.beginPath();ctx.arc(node.x,node.y,r,0,2*Math.PI);ctx.fillStyle=node.color;ctx.shadowColor=node.color;ctx.shadowBlur=active?10:0;ctx.fill();ctx.shadowBlur=0;
          if(active&&this.highlight.size||['project','case','person','training','historical','archive','design_review','facility_unit','design_finding'].includes(node.kind)){ctx.font=`${Math.max(11/scale,3)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle=['gap','historical','review_pending'].includes(node.status)?'#ffa2ad':'#d5e6ee';ctx.fillText(node.label.slice(0,25),node.x,node.y+r+5/scale);}ctx.globalAlpha=1;})
        .nodePointerAreaPaint((n,color,ctx)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(n.x,n.y,this.nodeSize(n)+4,0,2*Math.PI);ctx.fill();})
        .linkColor(l=>this.linkColor(l)).linkWidth(l=>this.linkActive(l)?2:1).linkDirectionalParticleWidth(2).linkDirectionalParticleSpeed(.002)
        .onNodeHover(n=>this.onHover(n)).onNodeClick(n=>this.select(n)).onBackgroundClick(()=>{this.selected=null;this.updateHighlight();this.overview();})
        .onNodeDragEnd(n=>{n.fx=n.x;n.fy=n.y;}).cooldownTicks(reduced.matches ? 0 : 150).graphData(this.data);
      this.graph.d3Force('charge').strength(-240); this.graph.d3Force('link').distance(95); this.fitPending=true; this.graph.onEngineStop(()=>{if(this.pendingFocusId&&this.selected?.findingId===this.pendingFocusId&&!this.destroyed){this.pendingFocusId='';this.select(this.selected);}else if(this.fitPending&&!this.destroyed){this.fitPending=false;this.fit(false);}}); this.updateHighlight();
    }
    linkActive(l) { const a=typeof l.source==='object'?l.source.id:l.source,b=typeof l.target==='object'?l.target.id:l.target;return this.highlight.size && this.highlight.has(a)&&this.highlight.has(b); }
    linkColor(l) { return this.highlight.size&&!this.linkActive(l)?'#18313c':l.color||'#539caa'; }
    onHover(n) { this.hover=n;this.stage.style.cursor=n?'pointer':'grab';this.updateHighlight(); }
    updateHighlight() {
      const active=this.hover||this.selected; this.highlight = active ? new Set(this.adjacency.get(active.id)||[active.id]) : new Set(this.matches().map(n=>n.id));
      if(this.state.mode==='3d')for(const [id,obj] of this.nodeObjects||[]){const on=!this.highlight.size||this.highlight.has(id);obj.mesh.material.opacity=on?1:.12;obj.mesh.material.emissiveIntensity=on?.48:.02;obj.mesh.scale.setScalar(active?.id===id?1.28:1);obj.sprite.material.opacity=on?1:.12;obj.sprite.visible=(this.highlight.has(id)||id===active?.id||['project','case','person','training','historical','archive','design_review','facility_unit','design_finding'].includes(obj.kind))&&on;}
      if(this.graph)this.graph.linkColor(l=>this.linkColor(l)).linkWidth(l=>this.linkActive(l)?(this.state.mode==='3d'?1.15:2):this.state.mode==='3d'?.35:1);
    }
    select(node) {
      if(!node)return;this.fitPending=false;this.$('#mxg-search-results').hidden=true;this.selected=this.data.nodes.find(n=>n.id===node.id)||node;this.hover=null;this.updateHighlight();this.inspect(this.selected);
      for(const b of this.root.querySelectorAll('[data-mxg-node]'))b.classList.toggle('selected',b.dataset.mxgNode===node.id);
      const n=this.selected;if(!this.graph||!Number.isFinite(n.x))return;
      this.state.motion=false;this.motion();this.controlsUI();
      if(this.state.mode==='3d'){const camera=this.graph.cameraPosition(),distance=Math.hypot(camera.x-n.x,camera.y-n.y,camera.z-n.z)||1;const ratio=375/distance;this.graph.cameraPosition({x:n.x+(camera.x-n.x)*ratio,y:n.y+(camera.y-n.y)*ratio,z:n.z+(camera.z-n.z)*ratio},n,reduced.matches?0:700);}
      else{this.graph.centerAt(n.x,n.y,reduced.matches?0:600);this.graph.zoom(1.6,reduced.matches?0:600);}
    }
    overview() {
      const counts=this.model.counts||{},issues=this.model.nodes.filter(n=>['gap','historical','pending','review_pending'].includes(n.status)).sort((a,b)=>Number(b.issueKind==='source_conflict')-Number(a.issueKind==='source_conflict')||Number(b.status==='review_pending')-Number(a.status==='review_pending'));
      this.$('#mxg-detail').innerHTML=`<div class="mxg-inspector-eyebrow">WORKSPACE OVERVIEW</div><h2>每条连线，都有来处。</h2><p class="mxg-detail-desc">选择一个节点，查看建设范围、工作和原文依据。${counts.designReviews ? `当前 ${counts.cases || 0} 项专项工作、${counts.designReviews} 份专篇初评，分别统计。` : ''}</p><div class="mxg-overview-stats"><div><strong>${(counts.cases || 0) + (counts.designReviews || 0)}</strong><span>工作 / 初评分组</span></div><div><strong>${counts.documents??this.snapshot.documents.length}</strong><span>去重原件</span></div></div><div class="mxg-issue-heading"><span class="mxg-red-dot"></span><b>需要关注</b><span>${issues.length} 个节点</span></div><div class="mxg-issue-preview">${issues.slice(0,3).map(n=>`<button data-mxg-node="${escape(n.id)}"><span>${escape(statusNames[n.status])}</span><b>${escape(n.label)}</b>${svg('arrow',14)}</button>`).join('')||'<p>当前显示范围没有提示节点。仍需以工作中的核对范围为准。</p>'}</div><div class="mxg-inspector-note">同一工作或专篇初评使用同色。红色包含原文待核事项、缺口及历史问题；原文待核不等于违法或现场风险结论。资料未知保持待核实。</div>`;
    }
    inspect(n) {
      const doc=this.snapshot.documents.find(d=>d.id===n.documentId),item=this.snapshot.cases.find(c=>c.id===n.caseId);const segment=doc?.segments?.find(s=>s.locator===n.locator);
      const relatedIds=new Set(this.model.links.filter(l=>l.source===n.id||l.target===n.id).flatMap(l=>[l.source,l.target]));const related=this.model.nodes.filter(v=>v.id!==n.id&&relatedIds.has(v.id)&&['facility_unit','standard_reference'].includes(v.kind));
      const detail=typeof n.detail==='string'?n.detail:JSON.stringify(n.detail||{});
      this.$('#mxg-detail').innerHTML=`<div class="mxg-inspector-eyebrow">${escape(kinds[n.kind]||n.kind)} / NODE DETAIL</div><div class="mxg-node-title"><i style="background:${escape(n.color)}"></i><h2>${escape(n.label)}</h2></div><span class="mxg-state ${escape(n.status === 'review_pending' ? 'pending' : n.status)}">${escape(statusNames[n.status]||'已关联')}</span><p class="mxg-detail-desc">${escape(detail)}</p>${item?`<dl><dt>所属工作</dt><dd>${escape(item.title)}</dd><dt>当前校核</dt><dd>${escape(item.evaluation?.label||'待核实')}</dd></dl>`:''}${doc?`<dl><dt>原始资料</dt><dd>${escape(doc.name)}</dd><dt>内容位置</dt><dd>${escape(n.locator||'选择原件查看具体内容')}</dd></dl>${segment?`<blockquote>${escape(segment.text.slice(0,650))}</blockquote>`:''}<button class="mxg-primary" data-mxg="document">查看原件与定位 ${svg('arrow',16)}</button>`:''}${item?`<button class="mxg-secondary" data-mxg="case">进入工作核对 ${svg('arrow',16)}</button>`:''}${n.separationId?`<button class="mxg-secondary" data-mxg="facility">在沙盘查看间距 ${svg('arrow',16)}</button>`:''}${related.length?`<div class="mxg-issue-heading"><b>涉及装置与依据</b></div><div class="mxg-issue-preview">${related.map(v=>`<button data-mxg-node="${escape(v.id)}"><b>${escape(v.label)}</b>${svg('arrow',14)}</button>`).join('')}</div>`:''}<small class="mxg-detail-note">节点与连线用于说明关联，不改写已确认事实或工作完成状态。</small>`;
    }
    replot() {if(!this.graph)return;this.fitPending=true;this.selected=null;this.hover=null;this.clearNodeObjects();this.graph.graphData(this.data);this.updateHighlight();this.motion();this.fit();}
    fit(animate=true) {
      if(!this.graph)return;const ms=animate&&!reduced.matches?650:0;
      if(this.state.mode==='3d'){const camera=this.graph.camera(),aspect=this.stage.clientWidth/Math.max(this.stage.clientHeight,1);const fov=Math.min(camera.fov*Math.PI/180,2*Math.atan(Math.tan(camera.fov*Math.PI/360)*aspect));const distance=220/Math.sin(fov/2)*1.12;this.graph.cameraPosition({x:distance*.28,y:distance*.16,z:distance*.95},{x:0,y:0,z:0},ms);}
      else this.graph.zoomToFit(ms,55);
    }
    zoom(factor) {if(!this.graph)return;if(this.state.mode==='3d'){const target=this.graph.controls().target,p=this.graph.cameraPosition();this.graph.cameraPosition({x:target.x+(p.x-target.x)/factor,y:target.y+(p.y-target.y)/factor,z:target.z+(p.z-target.z)/factor},target,reduced.matches?0:220);}else this.graph.zoom(this.graph.zoom()*factor,reduced.matches?0:220);}
    moveKeyboard(key) {if(this.state.mode==='3d'){const p=this.graph.cameraPosition(),target=this.graph.controls().target,angle=(key==='ArrowLeft'||key==='ArrowUp'?1:-1)*.13;const x=p.x-target.x,y=p.y-target.y,z=p.z-target.z;this.graph.cameraPosition(key==='ArrowLeft'||key==='ArrowRight'?{x:target.x+x*Math.cos(angle)+z*Math.sin(angle),y:p.y,z:target.z+z*Math.cos(angle)-x*Math.sin(angle)}:{x:p.x,y:target.y+y*Math.cos(angle)+z*Math.sin(angle),z:target.z+z*Math.cos(angle)-y*Math.sin(angle)},target,reduced.matches?0:160);}else{const p=this.graph.centerAt();this.graph.centerAt(p.x+(key==='ArrowLeft'?-25:key==='ArrowRight'?25:0),p.y+(key==='ArrowUp'?-25:key==='ArrowDown'?25:0),150);}}
    motion() {if(!this.graph)return;if(this.state.mode==='3d')this.graph.controls().autoRotate=this.state.motion;this.graph.linkDirectionalParticles(this.state.motion?l=>['gap','historical','review_pending'].includes(l.status)?2:1:0);}
    resize() {if(!this.graph||this.destroyed)return;this.graph.width(this.stage.clientWidth).height(this.stage.clientHeight);}
    clearNodeObjects() { for (const obj of this.nodeObjects?.values() || []) for (const resource of obj.resources || []) { resource.dispose?.(); this.resources.delete(resource); } this.nodeObjects?.clear(); }
    disposeGraph() {
      if(this.graph){try{this.graph.pauseAnimation();if(this.graphMode==='3d'&&this.graph.controls)this.graph.controls().removeEventListener('start',this.controlStart);this.graph._destructor?.();}catch{}this.graph=null;}
      for(const resource of this.resources)resource.dispose?.();this.resources.clear();this.nodeObjects?.clear();
    }
    destroy(){if(this.destroyed)return;this.destroyed=true;++this.switchVersion;clearTimeout(this.searchTimer);this.abort.abort();this.resizeObserver.disconnect();this.routeObserver.disconnect();this.disposeGraph();if(current===this)current=null;}
  }
  window.MXZGraphExplorer={template,mount(root,options){if(!root)return;current?.destroy();current=new Explorer(root,options);},destroy(){current?.destroy();}};
})();
