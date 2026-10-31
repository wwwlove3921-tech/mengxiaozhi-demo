/* Construction map with contractor/permit records. Coordinates are schematic, not live tracking. */
(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = v => v ? new Date(v).toLocaleString('zh-CN', {hour12:false}) : '未登记';
  const localTime = v => {const d = new Date(v); return Number.isNaN(+d) ? '' : new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
  const kinds = ['生产','储存','公辅','环保','办公','其他'];
  const permitTypes = ['动火作业','受限空间作业','高处作业','吊装作业','临时用电作业','动土作业','断路作业','盲板抽堵作业','检维修作业','其他作业'];
  const states = {planned:'计划作业', active:'登记在作业', finished:'已结束', cancelled:'已取消'};
  const statusColor = {attention:'#d85b59', active:'#3b8a79', candidate:'#c79b39', idle:'#8ea394'};
  let active = null;
  function template(snapshot) {
    return `<section id="mxf-app" class="mxf-app" aria-label="企业动态沙盘">
      <header class="mxf-heading"><div><span class="mxf-eyebrow">ENTERPRISE IN VIEW <i>企业动态沙盘</i></span><h1>谁在哪个装置作业，一眼看清。</h1><p>从设计专篇或环评建立厂区，围绕承包商与作业票开展监督。</p></div><div class="mxf-heading-actions"><button class="secondary-btn" data-mxf="import">整理建设内容</button><button class="primary-btn" data-mxf="operation-new">登记作业 ＋</button></div></header>
      <div class="mxf-metrics" id="mxf-metrics"></div>
      <div class="mxf-workspace"><section class="mxf-map-panel" data-ui-card="off">
        <header class="mxf-map-header"><div><span class="mxf-live-dot"></span><b>${esc(snapshot.project?.name || '企业工作空间')}</b><small id="mxf-sync" role="status">正在读取本地记录…</small></div><button class="mxf-sync-button" data-mxf="refresh">↻ 同步</button></header>
        <div id="mxf-mode-notice" class="mxf-mode-notice"><b>作业分布</b> 建筑与位置为示意；间距数字取自专篇，不能按模型比例量距。</div>
        <div class="mxf-scene-toolbar"><div class="mxf-view-tabs" role="group" aria-label="沙盘视角"><button data-mxf="view-3d" aria-pressed="true">3D 立体</button><button data-mxf="view-top" aria-pressed="false">俯视总图</button><button data-mxf="view-flat" aria-pressed="false">原示意图</button></div><button class="mxf-separation-summary" data-mxf="separation-overview">间距依据</button><button class="mxf-expand-button" data-mxf="expand" aria-pressed="false">⛶ 展开沙盘</button></div><div class="mxf-map-stage"><div id="mxf-scene" class="mxf-scene" hidden></div><canvas id="mxf-canvas" tabindex="0" aria-label="企业建设与作业分布示意图，可拖动平移、滚轮缩放，也可从下方建设单元清单选择。"></canvas><div class="mxf-map-tip" hidden></div><div class="mxf-map-mark"><span>立体厂区 · 承包商 × 作业票</span><small id="mxf-scene-hint">正在加载三维场景…</small></div><div class="mxf-compass" aria-hidden="true">↗<small>示意</small></div><div class="mxf-map-tools"><button data-mxf="zoom-in" aria-label="放大沙盘">＋</button><button data-mxf="zoom-out" aria-label="缩小沙盘">−</button><button data-mxf="fit" aria-label="恢复沙盘视角">⌖</button><span></span><button data-mxf="motion" class="mxf-text-tool" aria-pressed="false" disabled>自动环绕</button><button data-mxf="labels" class="mxf-text-tool" aria-pressed="true" disabled>名称</button><button data-mxf="distances" class="mxf-text-tool" aria-pressed="true" disabled>间距</button></div><button type="button" class="mxf-mobile-detail" data-mxf="detail" hidden>查看选中装置的作业详情 →</button><div class="mxf-map-empty" hidden><b>用企业资料，展开这张图。</b><p>设计专篇或环评中的装置、储存区和配套设施，核对后成为作业登记的位置。</p><button class="primary-btn" data-mxf="import">整理建设内容</button><button class="secondary-btn" data-mxf="upload">上传专篇或环评</button></div></div>
        <footer class="mxf-map-footer"><span><i class="gap"></i>记录待核对</span><span><i class="complete"></i>登记在作业</span><span><i class="idle"></i>暂无在作业记录</span><small>灰线：专篇间距 · 红线：原文待核 · 绿线：承包商关联</small></footer>
      </section><aside class="mxf-inspector" id="mxf-inspector" data-ui-card="off"></aside></div>
      <section class="mxf-section mxf-operations-section" data-ui-card="off"><header><div><span class="mxf-eyebrow">WORK AT THE SITE</span><h2>承包商与作业票监督</h2></div><div class="mxf-ledger-tabs"><button data-mxf="tab-permits" aria-pressed="true">作业票台账</button><button data-mxf="tab-contractors" aria-pressed="false">承包商分布</button></div></header>
        <div class="mxf-ledger-toolbar"><div class="mxf-filter-buttons"><button data-mxf-filter="all" aria-pressed="true">全部</button><button data-mxf-filter="active">在作业</button><button data-mxf-filter="attention">待核对</button><button data-mxf-filter="finished">已结束</button></div><input id="mxf-search" type="search" placeholder="查承包商、作业票或装置…" aria-label="筛选承包商和作业票"></div><div id="mxf-ledger"></div>
      </section>
      <div class="mxf-bottom-grid"><section class="mxf-section" data-ui-card><header><div><span class="mxf-eyebrow">CONSTRUCTION REGISTER</span><h2>建设单元与原文依据</h2></div><button class="lw-text-link" data-mxf="manual">手动登记 ＋</button></header><div id="mxf-unit-list"></div></section>
      <section class="mxf-section mxf-connections" data-ui-card><header><div><span class="mxf-eyebrow">DATA SOURCES</span><h2>资料建图，记录更新</h2></div></header><div class="mxf-connection"><span class="mxf-connection-icon">▣</span><div><b>设计专篇 / 环评</b><small>保留原件、位置与人工核对结果</small></div><em>资料依据</em></div><div class="mxf-connection"><span class="mxf-connection-icon">☷</span><div><b>承包商 / 作业票台账</b><small>当前为手工登记，每 15 秒同步保存结果</small></div><em id="mxf-connection-state">连接中</em></div><div class="mxf-connection"><span class="mxf-connection-icon">⌁</span><div><b>企业作业系统接口</b><small>待接入企业接口与装置对应关系</small></div><em class="off">未接入</em></div><p class="mxf-boundary">登记人数以每项作业记录为依据。结束时间已过但状态仍为在作业的记录，会提示核对，不计入当前作业人次。</p></section></div>
      <p class="mxf-page-foot">厂区位置为示意排布 · 本地保存与同步 · 作业记录用于监督，不代替作业票审批</p><dialog class="mxf-dialog" id="mxf-dialog" aria-labelledby="mxf-dialog-title"></dialog></section>`;
  }
  class FacilityPage {
    constructor(root, options) {
      this.root=root; this.o=options; this.snapshot=options.snapshot; this.pid=this.snapshot.project.id;
      this.facility={revision:0,units:[],operations:[]}; this.selected=''; this.ledgerTab='permits'; this.filter='all'; this.search='';
      this.dead=false; this.busy=false; this.syncEpoch=0; this.abort=new AbortController(); this.canvas=root.querySelector('canvas');
      this.zoom=1; this.pan={x:0,y:0}; this.hits=[]; this.lastFrame=0; this.bind(); this.resize(); this.refresh(); this.initScene();
      this.frame=requestAnimationFrame(t=>this.draw(t));
    }
    $(s) { return this.root.querySelector(s) }
    listen(target,name,fn,opts={}) { target.addEventListener(name,fn,{...opts,signal:this.abort.signal}) }
    url(tail='') { return `/api/projects/${encodeURIComponent(this.pid)}/facility${tail}` }
    units() { return this.facility.units || [] }
    operations() { return this.facility.operations || [] }
    activity(op) {
      const d=op.derived;
      const live=d?.isCurrent===true;
      const issues=[];
      if(op.status==='active' && d?.timeStatus==='expired') issues.push('结束时间已过，状态待核对');
      if(op.status==='active' && d?.timeStatus==='future') issues.push('尚未到计划开始时间');
      if(d?.status==='needs_verification'&&!issues.length) issues.push('作业状态待核对');
      if(!op.permitNo&&op.status!=='cancelled') issues.push('作业票号待补');
      if(op.derived?.evidenceStatus==='needs_verification') issues.push('资料依据待核对');
      return {live,issues,label:issues.length?issues.join('；'):d?.label||states[op.status]||'状态待核对'};
    }
    unitActivity(unit) {
      const ops=this.operations().filter(op=>op.unitId===unit.id), current=ops.filter(op=>this.activity(op).live);
      return {ops,activeCount:current.length,people:current.reduce((n,op)=>n+op.peopleCount,0),contractors:new Set(current.map(op=>op.contractor).filter(Boolean)),attention:ops.some(op=>this.activity(op).issues.length)};
    }
    tone(u) {const a=this.unitActivity(u);return a.attention?'attention':!u.confirmed||u.derived?.evidenceStatus==='needs_verification'?'candidate':a.activeCount?'active':'idle'}
    unitLabel(u) {const a=this.unitActivity(u);return a.attention?'作业记录待核对':!u.confirmed?'建设内容待核对':u.derived?.evidenceStatus==='needs_verification'?'建设依据待核对':a.activeCount?`${a.activeCount} 项在作业 · ${a.people} 人次`:'暂无在作业记录'}
    bind() {
      this.listen(this.root,'click',e=>{
        const filter=e.target.closest('[data-mxf-filter]'); if(filter){this.filter=filter.dataset.mxfFilter;this.renderLedger();return}
        const unit=e.target.closest('[data-mxf-unit]'); if(unit){this.select(unit.dataset.mxfUnit);this.$('.mxf-workspace').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});return}
        const separation=e.target.closest('[data-mxf-separation]');if(separation){this.separationDialog(separation.dataset.mxfSeparation);return}
        const op=e.target.closest('[data-mxf-operation]'); if(op){this.operationDialog(this.operations().find(v=>v.id===op.dataset.mxfOperation));return}
        const contractor=e.target.closest('[data-mxf-contractor]'); if(contractor){this.search=contractor.dataset.mxfContractor;this.$('#mxf-search').value=this.search;this.ledgerTab='permits';this.filter='all';this.renderLedger();return}
        const b=e.target.closest('[data-mxf]'); if(!b)return;
        const a=b.dataset.mxf;
        if(a==='import')this.importDialog(); else if(a==='manual')this.editDialog(); else if(a==='upload')this.o.onUpload();
        else if(a==='edit')this.editDialog(this.units().find(u=>u.id===this.selected));
        else if(a==='operation-new')this.operationDialog(); else if(a==='document'){this.$('dialog').close();this.o.onOpenDocument(b.dataset.id,b.dataset.locator)}
        else if(a==='refresh')this.refresh(); else if(a==='zoom-in'){if(this.sceneVisible())this.scene3d.zoom(1.2);else this.zoom=Math.min(2.5,this.zoom*1.2)}
        else if(a==='zoom-out'){if(this.sceneVisible())this.scene3d.zoom(1/1.2);else this.zoom=Math.max(.55,this.zoom/1.2)} else if(a==='fit'){if(this.sceneVisible())this.scene3d.fit();else{this.zoom=1;this.pan={x:0,y:0}}}
        else if(a.startsWith('view-'))this.setView(a.slice(5));
        else if(a==='motion'&&this.scene3d){this.scene3d.setMotion(!this.scene3d.motion);b.setAttribute('aria-pressed',String(this.scene3d.motion))}
        else if(a==='labels'&&this.scene3d){this.scene3d.setLabels(!this.scene3d.showLabels);b.setAttribute('aria-pressed',String(this.scene3d.showLabels))}
        else if(a==='distances'&&this.scene3d){this.scene3d.setDistances(!this.scene3d.showDistances);b.setAttribute('aria-pressed',String(this.scene3d.showDistances))}
        else if(a==='separation-overview')this.separationOverview();
        else if(a==='compliance'){this.$('dialog').close();this.o.onOpenCompliance?.(b.dataset.id)}
        else if(a==='expand')this.toggleExpanded();
        else if(a==='detail'){if(this.root.classList.contains('mxf-expanded'))this.toggleExpanded();this.$('#mxf-inspector').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}
        else if(a==='close')this.$('dialog').close(); else if(a==='extract')this.extract(); else if(a==='save-candidates')this.saveCandidates();
        else if(a.startsWith('tab-')){this.ledgerTab=a.slice(4);this.renderLedger()}
      });
      this.listen(this.root,'submit',e=>{if(e.target.id==='mxf-unit-form'){e.preventDefault();this.saveUnit(e.target)}if(e.target.id==='mxf-operation-form'){e.preventDefault();this.saveOperation(e.target)}});
      this.listen(this.$('#mxf-search'),'input',e=>{this.search=e.target.value;this.renderLedger()});
      this.listen(this.canvas,'pointerdown',e=>{this.pointer={x:e.clientX,y:e.clientY,startX:this.pan.x,startY:this.pan.y,moved:false};this.canvas.setPointerCapture(e.pointerId)});
      this.listen(this.canvas,'pointermove',e=>{if(this.pointer){const dx=e.clientX-this.pointer.x,dy=e.clientY-this.pointer.y;if(Math.hypot(dx,dy)>4)this.pointer.moved=true;this.pan={x:this.pointer.startX+dx,y:this.pointer.startY+dy};return}const hit=this.hit(e);this.canvas.style.cursor=hit?'pointer':'grab';const tip=this.$('.mxf-map-tip');tip.hidden=!hit;if(hit){tip.innerHTML=`<b>${esc(hit.name)}</b><small>${esc(this.unitLabel(hit))}</small>`;const r=this.canvas.getBoundingClientRect();tip.style.left=`${Math.max(8,Math.min(e.clientX-r.left+12,r.width-220))}px`;tip.style.top=`${Math.max(10,e.clientY-r.top-60)}px`}});
      this.listen(this.canvas,'pointerup',e=>{const moved=this.pointer?.moved;this.pointer=null;if(!moved){const hit=this.hit(e);if(hit)this.select(hit.id)}});
      this.listen(this.canvas,'pointercancel',()=>{this.pointer=null});this.listen(this.canvas,'pointerleave',()=>this.$('.mxf-map-tip').hidden=true);
      this.listen(this.canvas,'wheel',e=>{e.preventDefault();this.zoom=Math.max(.55,Math.min(2.5,this.zoom*(e.deltaY<0?1.08:.925)))},{passive:false});
      this.listen(this.canvas,'keydown',e=>{if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();if(['+','='].includes(e.key))this.zoom=Math.min(2.5,this.zoom*1.2);if(e.key==='-')this.zoom=Math.max(.55,this.zoom/1.2);if(e.key==='0'){this.zoom=1;this.pan={x:0,y:0}}if(e.key==='ArrowLeft')this.pan.x-=25;if(e.key==='ArrowRight')this.pan.x+=25;if(e.key==='ArrowUp')this.pan.y-=25;if(e.key==='ArrowDown')this.pan.y+=25});
      this.listen(document,'visibilitychange',()=>{if(!document.hidden)this.refresh()});
      this.listen(document,'keydown',e=>{if(e.key==='Escape'&&this.root.classList.contains('mxf-expanded')&&!this.$('dialog').open)this.toggleExpanded()});
      this.ro=new ResizeObserver(()=>this.resize());this.ro.observe(this.canvas.parentElement);
      this.mo=new MutationObserver(()=>{if(!this.root.isConnected)this.destroy()});this.mo.observe(document.getElementById('page-content'),{childList:true});
      this.poll=setInterval(()=>{if(!document.hidden&&!this.busy)this.refresh()},15000);
    }
    async refresh() {
      if(this.syncing||this.dead||this.busy)return;this.syncing=true;const epoch=this.syncEpoch;
      try {const snapshot=await this.o.request(`/api/projects/${encodeURIComponent(this.pid)}`);
        if(this.dead||this.busy||epoch!==this.syncEpoch)return;
        const fingerprint=JSON.stringify([snapshot.facility,snapshot.documents]);const changed=fingerprint!==this.syncFingerprint;this.syncFingerprint=fingerprint;this.facility=snapshot.facility;this.snapshot=snapshot;this.o.onSnapshot?.(snapshot);this.lastSync=new Date();this.syncError='';if(changed)this.render();else {this.$('#mxf-sync').textContent=`演示快照 · ${this.lastSync.toLocaleTimeString('zh-CN',{hour12:false})}`;this.$('#mxf-connection-state').textContent='演示样本'}
      } catch(e) {if(!this.dead&&epoch===this.syncEpoch&&!this.busy){this.syncError=e.message;this.$('#mxf-sync').textContent='同步未成功 · '+e.message;this.$('#mxf-connection-state').textContent='连接中断'}}
      finally {this.syncing=false}
    }
    render() {
      if(this.dead)return;
      const ops=this.operations(),current=ops.filter(op=>this.activity(op).live),people=current.reduce((n,op)=>n+op.peopleCount,0),contractors=new Set(current.map(op=>op.contractor).filter(Boolean)),issues=ops.filter(op=>this.activity(op).issues.length);
      const metrics=[['建设单元',this.units().length,'个',`已核对 ${this.units().filter(u=>u.confirmed).length} 个`,'▦'],['在作业承包商',contractors.size,'家','依据有效时间内的作业记录','◈'],['登记在作业',current.length,'项',`${issues.length} 条记录需要核对`,'☷'],['登记作业人次',people,'人次','按作业累计，同人跨票未去重','♙']];
      this.$('#mxf-metrics').innerHTML=metrics.map(([label,n,suffix,small,i])=>`<article data-ui-card><span class="mxf-metric-icon">${i}</span><div><span>${label}</span><strong>${n}<small>${suffix}</small></strong><p>${small}</p></div></article>`).join('');
      this.$('#mxf-sync').textContent=`演示快照 · ${this.lastSync?.toLocaleTimeString('zh-CN',{hour12:false})||'等待连接'}`;this.$('#mxf-connection-state').textContent='演示样本';
      this.$('.mxf-map-empty').hidden=this.units().length>0;
      this.$('#mxf-unit-list').innerHTML=this.units().length?this.units().map(u=>`<button class="mxf-unit-row ${this.selected===u.id?'selected':''}" data-mxf-unit="${esc(u.id)}" data-ui-card><span class="mxf-unit-symbol">${({'生产':'▥','储存':'◉','公辅':'◫','环保':'≈','办公':'▤','其他':'▦'})[u.kind]||'▦'}</span><span><b>${esc(u.name)}</b><small>${esc(u.kind)} · ${esc(u.locator)}</small></span><em class="${esc(this.tone(u))}">${esc(this.unitLabel(u))}</em><i>↗</i></button>`).join(''):'<div class="mxf-list-empty"><b>还没有登记建设单元</b><p>上传设计专篇或环评，核对建设内容后，就能按装置登记承包商作业。</p><button class="secondary-btn" data-mxf="import">开始整理建设内容 →</button></div>';
      const sep=this.facility.separation,summary=this.$('.mxf-separation-summary');summary.textContent=sep?.status==='available'?`间距依据 · ${sep.attentionCount?sep.attentionCount+'处待核':sep.mappedCount+'段可连线'}`:'间距依据 · 待补';summary.classList.toggle('attention',!!sep?.attentionCount);
      this.renderInspector();this.renderLedger();this.scene3d?.update(this.units());this.scene3d?.select(this.selected);
      if(this.o.focusSeparationId){const id=this.o.focusSeparationId;this.o.focusSeparationId='';this.o.onFocusConsumed?.();const e=this.facility.separation?.entries?.find(e=>e.id===id);if(e){this.select(e.fromId||e.toId);this.separationDialog(id)}}
    }
    renderInspector() {
      const u=this.units().find(n=>n.id===this.selected);
      const detail=this.$('.mxf-mobile-detail');if(detail){detail.hidden=!u;if(u)detail.textContent=`${u.name} · 作业详情 →`;}
      if(!u){this.$('#mxf-inspector').innerHTML=`<div class="mxf-inspector-top"><span class="mxf-eyebrow">CONTRACTORS & PERMITS</span><h2>点一个装置，<br>看清谁在作业。</h2><p>承包商、作业票、登记人数和计划时间，集中在对应装置下查看。</p></div><div class="mxf-steps"><article><i>01</i><div><b>建设资料确定装置</b><p>设计专篇、环评与原文依据</p></div></article><article><i>02</i><div><b>作业记录确定人员归属</b><p>哪家承包商 · 哪张票 · 几人作业</p></div></article><article><i>03</i><div><b>持续核对作业状态</b><p>票号待补、结束超时集中提示</p></div></article></div><button class="primary-btn" data-mxf="operation-new">登记一项作业 ＋</button><p class="mxf-small-note">人员按记录归属到装置，不显示个人轨迹。</p>${this.separationPanel()}`;return}
      const a=this.unitActivity(u),doc=this.snapshot.documents.find(d=>d.id===u.documentId);
      this.$('#mxf-inspector').innerHTML=`<div class="mxf-detail-kicker"><span>${esc(u.kind)} / 建设单元</span><i style="background:${statusColor[this.tone(u)]}"></i></div><h2>${esc(u.name)}</h2><span class="mxf-status ${esc(this.tone(u))}">${esc(this.unitLabel(u))}</span><div class="mxf-unit-stats"><span><b>${a.contractors.size}</b>承包商</span><span><b>${a.activeCount}</b>在作业</span><span><b>${a.people}</b>登记人次</span></div><button class="primary-btn" data-mxf="operation-new">在此装置登记作业 ＋</button><div class="mxf-jobs-header"><b>该装置作业记录</b><span>${a.ops.length} 项</span></div>${a.ops.map(op=>`<button class="mxf-job" data-mxf-operation="${esc(op.id)}" data-ui-card><b>${esc(op.contractor||'本企业')} · ${op.peopleCount} 人</b><small>${esc(op.workName)}<br>${esc(op.permitNo||'作业票号待补')} · ${esc(this.activity(op).label)}</small><span>↗</span></button>`).join('')||'<p class="mxf-small-note">暂无登记作业，不据此判断现场无人或安全。</p>'}${this.separationPanel(u)}<details class="mxf-unit-evidence"><summary>查看建设资料依据</summary><div class="mxf-source-quote"><small>${esc(doc?.name||'原件待核对')} · ${esc(u.locator)}</small><p>${esc(u.excerpt)}</p>${u.notes?`<p class="mxf-source-notes">${esc(u.notes)}</p>`:''}${doc?`<button data-mxf="document" data-id="${esc(doc.id)}" data-locator="${esc(u.locator)}">查看原件 ↗</button>`:''}</div><button class="lw-text-link" data-mxf="edit">编辑建设单元</button></details>`;
    }
    separationPanel(unit) {
      const sep=this.facility.separation,entries=(sep?.entries||[]).filter(e=>!unit||e.fromId===unit.id||e.toId===unit.id).sort((a,b)=>Number(b.problems.length>0)-Number(a.problems.length>0));
      return `<section class="mxf-separation-panel"><header><b>设计间距</b><span>${entries.length} 组资料</span></header>${entries.slice(0,3).map(e=>`<button class="mxf-separation-row ${e.problems.length?'attention':''}" data-mxf-separation="${esc(e.id)}"><span>${esc(unit?(e.fromId===unit.id?e.toName:e.fromName):e.fromName+' ↔ '+e.toName)}<small>${e.problems.length?'原文数值待核':'专篇记载 · 现场未核实'}</small></span><b>${esc(e.label)}</b></button>`).join('')||'<p class="mxf-small-note">尚未匹配明确间距。请补充含尺寸的总平面布置图或间距表。</p>'}<button class="lw-text-link" data-mxf="separation-overview">查看间距与方位依据 →</button></section>`;
    }
    separationOverview() {
      const sep=this.facility.separation||{},entries=[...(sep.entries||[])].sort((a,b)=>Number(b.problems.length>0)-Number(a.problems.length>0));
      this.dialog('设计间距与方位依据',`<p class="mxf-dialog-intro">${esc(sep.notice||'请补充总平面布置图或列名明确的间距表。')}</p><p class="mxf-small-note">${entries.length} 组设施关系 · ${sep.mappedCount||0} 段可关联现有模型 · ${sep.attentionCount||0} 组原文数值待核。${esc(sep.coverage||'')}未匹配的预留设施、围墙等保留在清单中，不虚构模型位置。</p><div class="mxf-separation-register">${entries.map(e=>`<button class="mxf-separation-row ${e.problems.length?'attention':''}" data-mxf-separation="${esc(e.id)}"><span>${esc(e.fromName)} ↔ ${esc(e.toName)}<small>${e.problems.length?esc(e.problems.join('；')):e.mapped?'已关联模型 · 现场与现行规范待核':'名称或位置待匹配 · 仅保留原文'}</small></span><b>${esc(e.label)} ↗</b></button>`).join('')}</div><details class="mxf-position-evidence"><summary>总平面方位描述 · 未换算为实测坐标</summary>${(sep.positions||[]).map(p=>`<blockquote><small>${esc(p.locator)}</small><p>${esc(p.text)}</p><button class="lw-text-link" data-mxf="document" data-id="${esc(p.documentId)}" data-locator="${esc(p.locator)}">查看原文 ↗</button></blockquote>`).join('')||'<p>尚未提取明确的方位描述，请补充总平面图。</p>'}</details>`);
    }
    separationDialog(id) {
      const sep=this.facility.separation,e=sep?.entries?.find(item=>item.id===id);if(!e)return;
      this.dialog(`${esc(e.fromName)} ↔ ${esc(e.toName)}`,`<div class="mxf-distance-heading"><span>专篇记载间距<strong>${esc(e.label)}</strong></span><span class="mxf-status ${e.problems.length?'attention':'idle'}">${e.problems.length?'原文数值待核':'现场与现行规范待核'}</span></div>${e.problems.length?`<div class="mxf-distance-alert"><b>${esc(e.problems.join('；'))}</b><p>这是文件内部核对提示，尚不构成现场安全或违法结论。请核对原图、测量基准、适用条款及设计变更。</p></div>`:''}<p class="mxf-small-note">原表列名为“实际距离”，本平台仅作为专篇记载展示；尚无现场测量依据。图上连线长度不换算米数。</p>${e.evidence.map(r=>`<article class="mxf-distance-evidence"><header><b>${esc(r.fromName)} → ${esc(r.toName)}</b><small>原文方位：${esc(r.direction)}${r.inheritedDirection?'（续行）':''}</small></header><dl><div><dt>专篇记载</dt><dd>${esc(r.distanceText)} m</dd></div><div><dt>原文规范值</dt><dd>${esc(r.requirementText)}${r.requirement!==null?' m':''}</dd></div><div><dt>原文结论</dt><dd>${esc(r.conclusion||'未记载')}</dd></div></dl><p>${esc(r.standard)}<small>引用版本及适用条件待复核，不作为现行要求直接判定。</small></p><details><summary>查看原始表头、行文与上下文</summary><blockquote>${esc(r.header.text)}<hr>${esc(r.raw)}</blockquote>${r.inheritedName?`<p class="mxf-small-note">装置名称按同表 ${esc(r.sourceLocator)} 的续行归组，请结合原件合并单元格核对。</p>`:''}</details><footer><span>${esc(r.documentName)} · ${esc(r.locator)}</span><button class="lw-text-link" data-mxf="document" data-id="${esc(r.documentId)}" data-locator="${esc(r.locator)}">查看原件 ↗</button></footer></article>`).join('')}<details class="mxf-position-evidence"><summary>同表附注与条件</summary>${(sep.notes||[]).map(n=>`<p>${esc(n.locator)}：${esc(n.text)}</p>`).join('')||'<p>暂无提取的附注，请核对原件。</p>'}</details><p class="mxf-small-note">待补：竣工总图 / 现场测量记录、有效设计变更及现行条款适用核对。模型方位仍是示意。</p>${e.problems.length?`<button class="primary-btn" data-mxf="compliance" data-id="${esc(e.id)}">在合规图谱查看此问题 →</button>`:''}<button class="secondary-btn" data-mxf="separation-overview">查看全部间距</button>`);
    }
    renderLedger() {
      for(const b of this.root.querySelectorAll('[data-mxf-filter]'))b.setAttribute('aria-pressed',b.dataset.mxfFilter===this.filter);
      for(const b of this.root.querySelectorAll('.mxf-ledger-tabs button'))b.setAttribute('aria-pressed',b.dataset.mxf===`tab-${this.ledgerTab}`);
      const search=this.search.trim().toLowerCase();
      const ops=this.operations().filter(op=>{const a=this.activity(op),unit=this.units().find(u=>u.id===op.unitId);return (this.filter==='all'||this.filter==='active'&&a.live||this.filter==='attention'&&a.issues.length||this.filter==='finished'&&['finished','cancelled'].includes(op.status))&&(!search||[op.contractor||'本企业',op.workName,op.permitNo,unit?.name].join(' ').toLowerCase().includes(search))});
      const target=this.$('#mxf-ledger');
      if(!ops.length){target.innerHTML=`<div class="mxf-ledger-empty"><span>◎</span><b>${this.operations().length?'当前筛选下没有作业记录':'从一张作业票，开始了解现场。'}</b><p>登记装置、承包商、作业人数和时间，记录会同步显示在上方沙盘。</p><button class="secondary-btn" data-mxf="operation-new">登记作业 ＋</button></div>`;return}
      if(this.ledgerTab==='contractors'){
        const grouped=new Map();for(const op of ops){const name=op.contractor||'本企业';if(!grouped.has(name))grouped.set(name,[]);grouped.get(name).push(op)}
        target.innerHTML=`<div class="mxf-contractor-grid">${[...grouped].map(([name,records])=>{const current=records.filter(v=>this.activity(v).live);const units=[...new Set(records.map(v=>this.units().find(u=>u.id===v.unitId)?.name||'位置待核对'))];return `<button class="mxf-contractor-card" data-mxf-contractor="${esc(name)}" data-ui-card><span class="mxf-contractor-icon">▧</span><b>${esc(name)}</b><small>${esc(units.join(' · '))}</small><div><strong>${current.reduce((n,v)=>n+v.peopleCount,0)}<i>登记人次</i></strong><span>${current.length} 项在作业<br>${records.length} 条作业记录</span></div><em>查看相关作业票 ↗</em></button>`}).join('')}</div>`;return;
      }
      target.innerHTML=`<div class="mxf-operations-table"><div class="mxf-operations-head"><span>作业 / 承包商</span><span>装置与登记人数</span><span>作业票与时间</span><span>记录状态</span></div>${ops.map(op=>{const unit=this.units().find(u=>u.id===op.unitId),a=this.activity(op);return `<button class="mxf-operation-row" data-mxf-operation="${esc(op.id)}" data-ui-card><span><b>${esc(op.workName)}</b><small>${esc(op.contractor||'本企业')}</small></span><span><b>${esc(unit?.name||'位置待核对')}</b><small>登记 ${op.peopleCount} 人</small></span><span><b>${esc(op.permitNo||'作业票号待补')}</b><small>${esc(op.permitType)}<br>${esc(date(op.startAt))} —<br>${esc(date(op.endAt))}</small></span><span><em class="mxf-status ${a.issues.length?'attention':a.live?'active':'idle'}">${esc(a.label)}</em><small>查看 / 更新 ↗</small></span></button>`}).join('')}</div>`;
    }
    select(id) {this.selected=id;this.scene3d?.select(id);this.$('.mxf-map-tip').hidden=true;this.renderInspector();for(const b of this.root.querySelectorAll('[data-mxf-unit]'))b.classList.toggle('selected',b.dataset.mxfUnit===id)}
    dialog(title,body) {const d=this.$('dialog');this.dialogVersion=(this.dialogVersion||0)+1;if(d.open)d.close();d.innerHTML=`<header><div><span class="mxf-eyebrow">SITE MANAGEMENT</span><h2 id="mxf-dialog-title">${title}</h2></div><button data-mxf="close" aria-label="关闭窗口">×</button></header><div class="mxf-dialog-body">${body}</div><p id="mxf-form-error" role="alert"></p>`;d.showModal();return d}
    docOptions(value='') {return '<option value="">选择已上传的原件</option>'+[...this.snapshot.documents].sort((a,b)=>['design','environment'].includes(b.kind)-['design','environment'].includes(a.kind)).map(d=>`<option value="${esc(d.id)}" ${value===d.id?'selected':''}>${esc(d.name)}${d.kind==='design'?' · 设计专篇':d.kind==='environment'?' · 环评':''}</option>`).join('')}
    importDialog() {this.candidates=[];this.dialog('从设计专篇或环评整理建设单元',`<p class="mxf-dialog-intro">提取建设内容中的装置、储存区及配套设施，核对原文后建立沙盘。名称与分类可在保存前调整。</p><div class="mxf-import-source"><label>设计专篇 / 环评原件<select id="mxf-source">${this.docOptions(this.snapshot.documents.find(d=>['design','environment'].includes(d.kind))?.id)}</select></label><button class="primary-btn" data-mxf="extract">提取建设内容</button></div><button class="lw-text-link" data-mxf="upload">先上传设计专篇或环评 ↗</button><div id="mxf-candidates"><div class="mxf-dialog-placeholder">支持已完成文字提取的 PDF、Word、表格及文本。扫描件需先完成本机 OCR。</div></div>`)}
    async extract() {
      const docId=this.$('#mxf-source').value;if(!docId)return this.error('请先选择设计专篇或环评原件。');
      const dialogVersion=this.dialogVersion;const b=this.$('[data-mxf=extract]');b.disabled=true;b.textContent='正在整理原文…';this.error('');
      try {const result=await this.o.request(this.url('/extract'),{method:'POST',body:{documentId:docId,expectedRevision:this.facility.revision}});if(this.dead||this.dialogVersion!==dialogVersion||!this.$('dialog').open)return;
        this.candidates=result.candidates;this.extractRevision=result.baseRevision;this.extractSource=docId;this.extractBase=structuredClone(this.facility.units);
        this.$('#mxf-candidates').innerHTML=`<div class="mxf-candidate-heading"><b>找到 ${result.candidates.length} 个候选</b><span>待核对 · 尚未入库</span></div>${(result.warnings||[]).map(w=>`<p class="mxf-import-warning">${esc(w)}</p>`).join('')}${result.candidates.map((u,i)=>`<article class="mxf-candidate"><label class="mxf-candidate-check"><input type="checkbox" data-candidate="${i}" checked><b>${esc(u.name)}</b></label><div class="mxf-candidate-fields"><label>单元名称<input data-name="${i}" value="${esc(u.name)}" maxlength="120"></label><label>分类<select data-kind="${i}">${kinds.map(k=>`<option ${k===u.kind?'selected':''}>${k}</option>`).join('')}</select></label></div><p>${esc(u.excerpt)}</p><small>${esc(u.locator)}</small></article>`).join('')}${result.candidates.length?'<label class="mxf-confirm"><input id="mxf-confirm" type="checkbox">我已核对所选单元及原文依据，确认加入企业建设台账。</label><button class="primary-btn" data-mxf="save-candidates">确认并加入沙盘</button>':'<p class="mxf-dialog-placeholder">没有新的候选。已登记单元不会重复覆盖，也可引用原文手动登记。</p><button class="secondary-btn" data-mxf="manual">手动登记建设单元</button>'}`;
      }catch(e){this.error(e.message)}finally{if(b.isConnected){b.disabled=false;b.textContent='重新提取建设内容'}}
    }
    error(text) {const n=this.$('#mxf-form-error');if(n)n.textContent=text}
    async saveCandidates() {
      if(!this.$('#mxf-confirm')?.checked)return this.error('请先核对原文并勾选确认。');
      const selected=[...this.root.querySelectorAll('[data-candidate]:checked')].map(el=>{const i=Number(el.dataset.candidate);return {...this.candidates[i],name:this.$(`[data-name="${i}"]`).value.trim(),kind:this.$(`[data-kind="${i}"]`).value,confirmed:true}});
      if(!selected.length)return this.error('请选择至少一个建设单元。');const ids=new Set(this.extractBase.map(u=>u.id));
      await this.save({expectedRevision:this.extractRevision,sourceDocumentId:this.extractSource,units:[...this.extractBase,...selected.filter(u=>!ids.has(u.id))]});
    }
    bindEvidence(form,docKey,locatorKey,initialLocator='') {
      const select=form.elements[locatorKey];const quote=form.querySelector('[data-source-excerpt]');
      const setExcerpt=()=>{const doc=this.snapshot.documents.find(v=>v.id===form.elements[docKey].value);quote.textContent=doc?.segments?.find(s=>s.locator===select.value)?.text||'选择原件与位置后，可在这里核对原文。'};
      const setLocators=()=>{const doc=this.snapshot.documents.find(v=>v.id===form.elements[docKey].value);select.innerHTML='<option value="">选择原文位置</option>'+(doc?.segments||[]).map(s=>`<option value="${esc(s.locator)}" ${s.locator===initialLocator?'selected':''}>${esc(s.locator)} · ${esc(s.text.slice(0,100))}</option>`).join('');select.required=Boolean(doc);setExcerpt()};
      form.elements[docKey].addEventListener('change',setLocators,{signal:this.abort.signal});select.addEventListener('change',setExcerpt,{signal:this.abort.signal});setLocators();
    }
    editDialog(unit) {
      const base=unit?structuredClone(unit):{id:crypto.randomUUID(),name:'',kind:'生产',capacity:'',raw:'',x:20+(this.units().length%3)*27,y:22+Math.floor(this.units().length/3)%3*27,documentId:'',locator:'',excerpt:'',confirmed:false,caseIds:[],notes:''};
      this.editing={unit:base,revision:this.facility.revision,units:structuredClone(this.units())};
      const d=this.dialog(unit?'编辑建设单元':'引用原文登记建设单元',`<form id="mxf-unit-form"><div class="mxf-form-grid"><label>单元名称<input name="name" value="${esc(base.name)}" maxlength="120" required></label><label>单元分类<select name="kind">${kinds.map(k=>`<option ${k===base.kind?'selected':''}>${k}</option>`).join('')}</select></label><label class="wide">资料原件<select name="documentId" required>${this.docOptions(base.documentId)}</select></label><label class="wide">原文位置<select name="locator" required></select></label><blockquote class="wide" data-source-excerpt></blockquote><label class="wide">规模或建设内容（摘录原文）<textarea name="capacity" rows="2" maxlength="2000">${esc(base.capacity)}</textarea></label><label>示意位置 X（0–100）<input name="x" type="number" min="0" max="100" value="${base.x}" required></label><label>示意位置 Y（0–100）<input name="y" type="number" min="0" max="100" value="${base.y}" required></label></div><p class="mxf-small-note">位置仅用于示意排布，不表示设计图坐标或实际安全间距。</p><label class="mxf-confirm"><input name="confirmed" type="checkbox" ${base.confirmed?'checked':''}>已核对建设内容与原文依据</label><label>补充说明<textarea name="notes" rows="2" maxlength="2000">${esc(base.notes)}</textarea></label><button class="primary-btn" type="submit">保存建设单元</button></form>`);
      this.bindEvidence(d.querySelector('form'),'documentId','locator',base.locator);
    }
    async saveUnit(form) {
      const f=new FormData(form),doc=this.snapshot.documents.find(d=>d.id===f.get('documentId')),segment=doc?.segments?.find(s=>s.locator===f.get('locator'));
      if(!segment)return this.error('请选择本企业原件中的有效原文位置。');
      const u={...this.editing.unit,name:f.get('name').trim(),kind:f.get('kind'),capacity:f.get('capacity').trim(),x:Number(f.get('x')),y:Number(f.get('y')),documentId:doc.id,locator:segment.locator,excerpt:segment.text.slice(0,2000),raw:segment.text.slice(0,2000),confirmed:f.has('confirmed'),notes:f.get('notes').trim()};
      const units=this.editing.units.filter(n=>n.id!==u.id);units.push(u);await this.save({expectedRevision:this.editing.revision,sourceDocumentId:this.facility.sourceDocumentId||doc.id,units});
    }
    operationDialog(operation) {
      if(!this.units().length){this.dialog('先登记作业所在装置',`<p class="mxf-dialog-intro">从设计专篇或环评整理建设单元后，作业票和承包商就有明确的归属位置。</p><button class="primary-btn" data-mxf="import">整理建设内容</button>`);return}
      const now=Date.now();const base=operation?structuredClone(operation):{id:crypto.randomUUID(),unitId:this.selected||this.units()[0].id,contractor:'',workName:'',permitNo:'',permitType:'检维修作业',peopleCount:1,startAt:new Date(now).toISOString(),endAt:new Date(now+2*3600000).toISOString(),status:'planned',sourceDocumentId:'',sourceLocator:'',notes:''};
      this.editOperation={base,revision:this.facility.revision,units:structuredClone(this.units()),operations:structuredClone(this.operations()),sourceDocumentId:this.facility.sourceDocumentId};
      const d=this.dialog(operation?'查看与更新作业记录':'登记承包商作业',`<form id="mxf-operation-form"><p class="mxf-dialog-intro">记录承包商在哪个装置、持哪张票、几人作业。更新这里的状态不会向企业系统提交审批。</p><div class="mxf-form-grid"><label class="wide">所属装置 / 建设单元<select name="unitId" required>${this.units().map(u=>`<option value="${esc(u.id)}" ${u.id===base.unitId?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label><label>承包商（本企业自营可留空）<input name="contractor" maxlength="120" value="${esc(base.contractor)}" placeholder="如：某检修公司；留空表示本企业"></label><label>作业内容<input name="workName" maxlength="180" value="${esc(base.workName)}" placeholder="如：换热器检修" required></label><label>作业票号<input name="permitNo" maxlength="120" value="${esc(base.permitNo)}" placeholder="未取得时可留空，台账提示待补"></label><label>作业类型<select name="permitType">${[...new Set([...permitTypes,base.permitType])].map(k=>`<option ${k===base.permitType?'selected':''}>${esc(k)}</option>`).join('')}</select></label><label>登记作业人数<input name="peopleCount" type="number" min="1" max="999" step="1" value="${base.peopleCount}" required></label><label>记录状态<select name="status">${Object.entries(states).map(([value,label])=>`<option value="${value}" ${base.status===value?'selected':''}>${label}</option>`).join('')}</select></label><label>计划开始时间<input name="startAt" type="datetime-local" value="${localTime(base.startAt)}" required></label><label>计划结束时间<input name="endAt" type="datetime-local" value="${localTime(base.endAt)}" required></label><label class="wide">依据原件（可选）<select name="sourceDocumentId">${this.docOptions(base.sourceDocumentId)}</select></label><label class="wide">原文位置<select name="sourceLocator"></select></label><blockquote class="wide" data-source-excerpt></blockquote><label class="wide">补充说明<textarea name="notes" rows="2" maxlength="2000">${esc(base.notes)}</textarea></label></div><p class="mxf-small-note">每条记录登记一项作业。同一张作业票不重复登记；同一人参与多张票时，汇总人次不会自动去重。</p>${operation?`<p class="mxf-small-note">资料依据：${operation.derived?.evidenceStatus==='manual'?'手工登记，未关联原件':operation.derived?.evidenceStatus==='needs_verification'?'原文或版本变化，待重新核对':'已关联原件'}<br>最近登记更新：${esc(date(operation.updatedAt||operation.recordedAt))}</p>${operation.derived?.evidenceStatus==='needs_verification'?'<label class="mxf-confirm"><input type="checkbox" name="evidenceReviewed">我已重新核对当前所选原文，确认更新本条作业的资料依据。</label>':''}`:''}<button class="primary-btn" type="submit">保存作业记录</button></form>`);
      this.bindEvidence(d.querySelector('form'),'sourceDocumentId','sourceLocator',base.sourceLocator);
    }
    async saveOperation(form) {
      const f=new FormData(form),start=new Date(f.get('startAt')),end=new Date(f.get('endAt'));
      if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)return this.error('请填写有效的作业时间，结束时间应晚于开始时间。');
      const op={...this.editOperation.base,unitId:f.get('unitId'),contractor:f.get('contractor').trim(),workName:f.get('workName').trim(),permitNo:f.get('permitNo').trim(),permitType:f.get('permitType'),peopleCount:Number(f.get('peopleCount')),startAt:start.toISOString(),endAt:end.toISOString(),status:f.get('status'),sourceDocumentId:f.get('sourceDocumentId'),sourceLocator:f.get('sourceDocumentId')?f.get('sourceLocator'):'',evidenceReviewed:f.has('evidenceReviewed'),notes:f.get('notes').trim()};
      const operations=this.editOperation.operations.filter(v=>v.id!==op.id);operations.push(op);
      await this.save({expectedRevision:this.editOperation.revision,sourceDocumentId:this.editOperation.sourceDocumentId,units:this.editOperation.units,operations},op.unitId);
    }
    async save(body,selectedId) {
      if(this.busy)return;this.busy=true;this.syncEpoch++;const buttons=this.$('dialog').querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
      try {const result=await this.o.request(this.url(),{method:'PUT',body});if(this.dead)return;
        this.facility=result.facility;this.snapshot=result.snapshot;this.syncFingerprint=JSON.stringify([result.snapshot.facility,result.snapshot.documents]);this.o.onSnapshot?.(result.snapshot);this.selected=selectedId||body.units.at(-1)?.id||'';
        this.$('dialog').close();this.lastSync=new Date();this.render();
      }catch(e){this.error(e.status===409?'记录已在其他页面更新。本次修改未保存，请关闭窗口、同步最新记录后重新核对。':e.message)}
      finally{this.busy=false;buttons.forEach(b=>{if(b.isConnected)b.disabled=false})}
    }
    sceneVisible() {return !!this.scene3d&&!this.$('#mxf-scene').hidden}
    async initScene() {
      try {const {FacilityScene}=await import('./vendor/facility-3d.js');if(this.dead)return;
        const host=this.$('#mxf-scene');host.hidden=false;
        this.scene3d=new FacilityScene(host,{separation:()=>this.facility.separation?.entries||[],onDistance:id=>this.separationDialog(id),tone:u=>this.tone(u),onSelect:id=>this.select(id),onMotion:value=>this.$('[data-mxf=motion]')?.setAttribute('aria-pressed',String(value)),onError:message=>this.sceneFailure(message),
          related:u=>{const names=this.unitActivity(u).contractors;return this.units().filter(other=>other.id!==u.id&&[...this.unitActivity(other).contractors].some(c=>names.has(c))).map(other=>other.id)},
          onHover:(u,e)=>{const tip=this.$('.mxf-map-tip');tip.hidden=!u;if(u){tip.innerHTML=`<b>${esc(u.name)}</b><small>${esc(this.unitLabel(u))}</small>`;const r=host.getBoundingClientRect();tip.style.left=`${Math.max(8,Math.min(e.clientX-r.left+12,r.width-220))}px`;tip.style.top=`${Math.max(70,e.clientY-r.top-60)}px`}}});
        this.scene3d.update(this.units());this.scene3d.select(this.selected);this.setView(this.requestedView||'3d');
      }catch(e){if(!this.dead)this.sceneFailure('三维模式暂不可用，仍可使用原示意图和全部台账。')}
    }
    sceneFailure(message) {
      this.scene3d?.dispose();this.scene3d=null;this.$('#mxf-scene').replaceChildren();this.setView('flat');this.$('#mxf-scene-hint').textContent=message;
    }
    setView(view) {
      this.requestedView=view;const flat=view==='flat'||!this.scene3d;
      this.$('#mxf-scene').hidden=flat;this.canvas.hidden=!flat;
      for(const b of this.root.querySelectorAll('[data-mxf^="view-"]'))b.setAttribute('aria-pressed',String(b.dataset.mxf===`view-${flat?'flat':view}`));
      for(const action of ['motion','labels','distances'])this.$(`[data-mxf=${action}]`).disabled=flat;
      if(this.scene3d){this.scene3d.setMotion(false);this.$('[data-mxf=motion]').setAttribute('aria-pressed','false');if(!flat){this.scene3d.resize();this.scene3d.fit(view==='top'?'top':'perspective')}}
      this.root.dataset.sceneMode=flat?'flat':view;this.$('#mxf-scene-hint').textContent=flat?'拖动平移 · 滚轮缩放':view==='top'?'俯视厂区 · 滚轮缩放 · 点击装置':'拖动旋转 · 右键平移 · 滚轮缩放';this.$('.mxf-map-tip').hidden=true;this.resize();
    }
    toggleExpanded() {
      const expanded=this.root.classList.toggle('mxf-expanded');const b=this.$('[data-mxf=expand]');b.textContent=expanded?'⛶ 收起沙盘':'⛶ 展开沙盘';b.setAttribute('aria-pressed',String(expanded));this.resize();
    }
    resize(){this.scene3d?.resize();const r=this.canvas.parentElement.getBoundingClientRect();this.w=r.width;this.h=r.height;const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.dpr=dpr}
    point(x,y,z=0){return{x:550+(x-y)*4.35,y:90+(x+y)*2.14-z}}
    poly(ctx,points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.8;ctx.stroke()}}
    tile(ctx,x,y,w,d,fill){this.poly(ctx,[this.point(x,y),this.point(x+w,y),this.point(x+w,y+d),this.point(x,y+d)],fill)}
    box(ctx,x,y,w,d,h,colors){const a=this.point(x,y,h),b=this.point(x+w,y,h),c=this.point(x+w,y+d,h),v=this.point(x,y+d,h);this.poly(ctx,[v,c,this.point(x+w,y+d),this.point(x,y+d)],colors[1],'#71877a55');this.poly(ctx,[b,c,this.point(x+w,y+d),this.point(x+w,y)],colors[2],'#71877a55');this.poly(ctx,[a,b,c,v],colors[0],'#71877a66')}
    tank(ctx,x,y,r,h){const p=this.point(x,y);ctx.fillStyle='#a9bab1';ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.43,0,0,Math.PI);ctx.lineTo(p.x-r,p.y-h);ctx.ellipse(p.x,p.y-h,r,r*.43,0,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();ctx.fillStyle='#e2e9df';ctx.beginPath();ctx.ellipse(p.x,p.y-h,r,r*.43,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#879d93';ctx.lineWidth=1.2;ctx.stroke();ctx.strokeStyle='#f2f6ec';ctx.beginPath();ctx.ellipse(p.x,p.y-h+9,r,r*.43,0,0,Math.PI);ctx.stroke();ctx.fillStyle='#6e9787';ctx.fillRect(p.x-3,p.y-h-8,6,8)}
    building(ctx,u,t){const x=u.x-8,y=u.y-6,selected=this.selected===u.id;const symbolScale=this.units().length>36?.48:this.units().length>16?.66:1,anchor=this.point(u.x,u.y);ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(symbolScale,symbolScale);ctx.translate(-anchor.x,-anchor.y);this.tile(ctx,x-3,y-3,24,20,selected?'#c8dcb8':'#ced8ca');
      if(u.kind==='储存'&&/罐|储液/.test(u.name)){this.tile(ctx,x,y,20,15,'#c3cdbd');this.tank(ctx,x+5,y+4,26,43);this.tank(ctx,x+15,y+9,26,43);}
      else if(u.kind==='办公'){this.box(ctx,x,y,18,11,78,['#dfe6cc','#c1ceb9','#a9bfae']);for(let r=0;r<3;r++)for(let c=0;c<4;c++){const p=this.point(x+c*4+1,y+11,60-r*20);this.poly(ctx,[p,{x:p.x+12,y:p.y+6},{x:p.x+12,y:p.y+18},{x:p.x,y:p.y+12}], '#6f9a96')}this.box(ctx,x+3,y+2,8,6,84,['#9fb2a2','#b9c8b7','#8ea395']);}
      else if(u.kind==='环保'){this.box(ctx,x,y,20,15,9,['#d0d9c7','#acbba7','#97ad9e']);for(let i=0;i<2;i++){const p=this.point(x+5+i*10,y+7,11);ctx.fillStyle='#75aba1';ctx.beginPath();ctx.ellipse(p.x,p.y,25,12,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a7d5c0';ctx.beginPath();ctx.ellipse(p.x,p.y,17,7,0,0,Math.PI*2);ctx.stroke()}}
      else if(u.kind==='公辅'){this.box(ctx,x,y,19,13,37,['#a7c4bc','#8faf9f','#7ca193']);this.tank(ctx,x+4,y+3,16,69);this.tank(ctx,x+12,y+5,16,64);this.box(ctx,x+11,y+12,4,3,23,['#dccb97','#c5b581','#ad9e6d']);}
      else {const production=u.kind==='生产';this.box(ctx,x,y,20,14,production?49:33,[production?'#a6c1b0':'#c4c6ac',production?'#7c9c8b':'#9faa8c',production?'#638974':'#8a9c82']);const h=production?49:33;for(let i=0;i<5;i++){const a=this.point(x+i*4,y,h+1),b=this.point(x+i*4,y+14,h+1);ctx.strokeStyle='#e6edda66';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}this.box(ctx,x+3,y+3,5,4,h+11,['#dce6d2','#a2b79e','#8fa48b']);if(production){this.box(ctx,x+18,y+1,2.4,2.4,82,['#d9dfc9','#b4beaa','#9da992']);this.box(ctx,x+14,y+1,2.4,2.4,69,['#d9dfc9','#b4beaa','#9da992'])}}
      const p=this.point(u.x,u.y,u.kind==='办公'?98:86),color=statusColor[this.tone(u)]||'#789';ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,6.5,0,Math.PI*2);ctx.fill();if(selected){ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.stroke()}
      ctx.restore();this.labels.push({u,p,anchor,symbolScale});}
    label(ctx,u,p,anchor,symbolScale){const selected=this.selected===u.id;const label=this.point(u.x,u.y+10,0);ctx.font='600 13px system-ui';const name=u.name.length>15?u.name.slice(0,15)+'…':u.name;const width=Math.min(220,ctx.measureText(name).width+24);ctx.fillStyle=selected?'#1b5847':'#ffffffed';ctx.beginPath();ctx.roundRect(label.x-width/2,label.y+3,width,28,6);ctx.fill();ctx.fillStyle=selected?'#fff':'#31594a';ctx.textAlign='center';ctx.fillText(name,label.x,label.y+22);const activity=this.unitActivity(u);if(activity.activeCount){ctx.font='600 12px system-ui';ctx.fillStyle='#245943';ctx.beginPath();ctx.roundRect(label.x-57,label.y+35,114,24,6);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(`${activity.activeCount} 项作业 · ${activity.people} 人次`,label.x,label.y+51)}const hitTop=anchor.y+(p.y-anchor.y)*symbolScale-12;this.hits.push({u,x:label.x-width/2,y:hitTop,w:width,h:label.y-hitTop+32});}
    draw(t) {
      if(this.dead)return;this.frame=requestAnimationFrame(time=>this.draw(time));if(document.hidden||this.sceneVisible()||t-this.lastFrame<50)return;this.lastFrame=t;
      const ctx=this.canvas.getContext('2d');ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.w,this.h);ctx.fillStyle='#eff3e9';ctx.fillRect(0,0,this.w,this.h);ctx.save();
      const scale=Math.min(this.w/1050,this.h/610)*this.zoom;this.transform={scale,tx:this.w/2-550*scale+this.pan.x,ty:this.h/2-310*scale+this.pan.y};ctx.translate(this.transform.tx,this.transform.ty);ctx.scale(scale,scale);
      this.box(ctx,0,0,100,100,4,['#e0e8d5','#c1cfb7','#b6c7ae']);for(let x=0;x<100;x+=10)for(let y=0;y<100;y+=10)this.tile(ctx,x,y,9.85,9.85,(x+y)%20?'#e0e8d5':'#dce6cf');
      this.tile(ctx,45,2,10,98,'#b8c6b8');this.tile(ctx,2,43,96,10,'#b8c6b8');for(let i=4;i<98;i+=8){this.tile(ctx,49.6,i,.6,3,'#e6ead8');this.tile(ctx,i,47.6,3,.6,'#e6ead8')}
      for(const [x,y] of [[5,15],[5,29],[5,72],[8,90],[93,10],[93,30],[94,83],[40,5],[64,5]]){const p=this.point(x,y);ctx.fillStyle='#8f9d70';ctx.fillRect(p.x-2,p.y-14,4,16);ctx.fillStyle='#8fac75';ctx.beginPath();ctx.ellipse(p.x,p.y-21,12,17,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a4bb86';ctx.beginPath();ctx.ellipse(p.x-3,p.y-25,8,11,0,0,Math.PI*2);ctx.fill()}
      // PixOffice orthogonal paths express same-contractor links, never walking routes.
      const chosen=this.units().find(u=>u.id===this.selected);
      if(chosen&&window.MXZFacilityPath){const names=this.unitActivity(chosen).contractors;const related=this.units().filter(u=>u.id!==chosen.id&&[...this.unitActivity(u).contractors].some(c=>names.has(c)));
        for(const target of related){const paths=window.MXZFacilityPath.elbowPaths({x:chosen.x,y:chosen.y},{x:target.x,y:target.y},()=>true);paths.sort(window.MXZFacilityPath.comparePaths);ctx.strokeStyle='#356e6d77';ctx.lineWidth=2;ctx.setLineDash([5,6]);ctx.beginPath();(paths[0]||[]).forEach((p,i)=>{const q=this.point(p.x,p.y);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.stroke();ctx.setLineDash([])}
      }
      this.hits=[];this.labels=[];this.units().slice().sort((a,b)=>a.x+a.y-b.x-b.y).forEach(u=>this.building(ctx,u,t));this.labels.forEach(({u,p,anchor,symbolScale})=>this.label(ctx,u,p,anchor,symbolScale));ctx.restore();
    }
    hit(event) {if(!this.transform)return;const r=this.canvas.getBoundingClientRect(),{scale,tx,ty}=this.transform,p={x:(event.clientX-r.left-tx)/scale,y:(event.clientY-r.top-ty)/scale};return [...this.hits].reverse().find(h=>p.x>=h.x&&p.x<=h.x+h.w&&p.y>=h.y&&p.y<=h.y+h.h)?.u}
    destroy() {if(this.dead)return;this.dead=true;this.scene3d?.dispose();cancelAnimationFrame(this.frame);clearInterval(this.poll);this.abort.abort();this.ro.disconnect();this.mo.disconnect();this.$('dialog')?.close();if(active===this)active=null}
  }
  window.MXZFacility={template,mount(root,options){if(!root)return;active?.destroy();active=new FacilityPage(root,options)},destroy(){active?.destroy()}};
})();
