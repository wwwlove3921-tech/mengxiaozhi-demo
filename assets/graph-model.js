/* Pure snapshot-to-graph projection. Visual references never duplicate stored originals. */
(function (root, factory) {
  const api = factory();
  root.MXZGraphModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const COLORS = Object.freeze({ groups: Object.freeze(['#68d4ff', '#b29bff', '#f4c676', '#64e2ba']), gap: '#ff657d', historical: '#ff657d', review_pending: '#ff657d', pending: '#f5c65b', not_applicable: '#8293a7', neutral: '#91b2d3' });
  const text = value => typeof value === 'string' ? value.trim() : '';
  const list = value => Array.isArray(value) ? value : [];
  const idPart = value => encodeURIComponent(String(value));
  const isIssue = status => ['gap', 'historical', 'pending', 'review_pending'].includes(status);
  const nodeGroup = node => node.groupId || node.caseId;
  const colorFor = (status, base) => COLORS[status] || base;
  const knownStatus = status => ['gap', 'pending', 'complete', 'not_applicable'].includes(status) ? status : 'pending';
  const readableRecordId = value => {
    const id = text(value);
    return id && !/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(id) ? id : '';
  };
  const plain = value => typeof value === 'string' ? value : value && typeof value === 'object' ? [value.title, value.detail || value.reason, value.nextAction].filter(Boolean).join('；') : '';
  const archiveLabels = { '4.4': '4.4 安全生产信息管理', '4.7': '4.7 装置安全规划与设计', '4.5': '4.5 安全教育、培训和能力建设', '4.9': '4.9 安全操作', '4.15': '4.15 变更管理' };

  function build(snapshot, options) {
    const opt = { scope: 'all', caseId: '', status: 'all', query: '', ...(options || {}) };
    const project = snapshot && snapshot.project;
    const projectId = text(project && project.id);
    const nodeMap = new Map(), linkMap = new Map();
    const allGroups = [], caseMeta = new Map();
    const documents = new Map(list(snapshot && snapshot.documents).filter(doc => doc && text(doc.id) && projectId && doc.projectId === projectId).map(doc => [doc.id, doc]));
    const cases = list(snapshot && snapshot.cases).filter(item => item && text(item.id) && projectId && item.projectId === projectId).slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id));
    const projectNodeId = `project:${idPart(projectId)}`;
    const addNode = node => {
      if (!nodeMap.has(node.id)) nodeMap.set(node.id, { caseId: '', status: 'normal', detail: '', ...node });
      return nodeMap.get(node.id);
    };
    const addLink = (source, target, label, status, color, extra) => {
      if (!nodeMap.has(source) || !nodeMap.has(target)) return;
      const id = `edge:${idPart(source)}:${idPart(target)}:${idPart(label)}`;
      if (!linkMap.has(id)) linkMap.set(id, { id, source, target, label, color: colorFor(status, color), status: status || 'normal', ...(extra || {}) });
    };
    if (projectId) addNode({ id: projectNodeId, kind: 'project', label: text(project.name) || '当前企业', detail: [project.site, project.industry, project.city].filter(Boolean).join(' · '), color: COLORS.neutral });
    const usedDocumentIds = new Set();
    cases.forEach((item, index) => {
      const caseId = item.id, prefix = `case:${idPart(caseId)}`, data = item.data || {}, evaluation = item.evaluation || null;
      const baseColor = COLORS.groups[index % COLORS.groups.length];
      const currentStatus = knownStatus(evaluation && evaluation.status);
      const history = list(evaluation && evaluation.historicalIssues);
      const taskStatus = history.length && currentStatus === 'complete' ? 'historical' : currentStatus;
      const group = { id: caseId, label: text(item.title) || '未命名工作', color: baseColor };
      allGroups.push(group);
      caseMeta.set(caseId, { currentStatus, history: history.length });
      const cn = (suffix, label, kind, status = 'normal', detail = '', extra = {}) => addNode({ id: `${prefix}:${suffix}`, label, kind, caseId, status, detail, color: colorFor(status, baseColor), ...extra });
      const edge = (from, to, label, status = 'normal', extra) => addLink(typeof from === 'string' ? from : from.id, typeof to === 'string' ? to : to.id, label, status, baseColor, { caseId, ...(extra || {}) });
      const task = cn('task', group.label, 'case', taskStatus, [evaluation?.label, evaluation?.reason, `业务状态：${data.businessStatus === 'closed' ? '已闭环' : '进行中'}`, history.length ? `另保留 ${history.length} 条历史问题，当前结果与历史问题分别展示。` : '', '以下原件节点为同一原件在本工作的可视引用，不复制原件。'].filter(Boolean).join('\n'), { currentStatus, action: { type: 'case', caseId } });
      addLink(projectNodeId, task.id, '企业工作', taskStatus, baseColor, { caseId });
      const documentRef = (documentId, from, relation, locator) => {
        const doc = documents.get(documentId);
        if (!doc) {
          const pending = cn(`missing:${idPart(from.id || from)}:${idPart(relation)}`, '原件待关联', 'requirement', 'pending', '当前项目没有可用的所引原件。这里只显示待核实要求，不创建假原件，也不显示其他项目资料。');
          edge(from, pending, relation, 'pending');
          return pending;
        }
        usedDocumentIds.add(doc.id);
        const parsed = doc.status === 'parsed';
        const pending = !parsed || doc.partial === true;
        const node = cn(`document:${idPart(doc.id)}`, text(doc.name) || '已保存原件', 'document', pending ? 'pending' : 'normal', `${parsed ? '已提取文本' : '原件已保存，提取尚未完成'}${doc.partial ? '；只提取部分内容，不能据此证明台账完整' : ''}。同一 documentId 表示同一原件；可在多个任务中显示引用。`, { documentId: doc.id, action: { type: 'document', documentId: doc.id } });
        edge(from, node, relation, pending ? 'pending' : 'normal');
        if (text(locator)) {
          const segment = list(doc.segments).find(s => s && text(s.locator) === text(locator) && text(s.text));
          const anchor = cn(`anchor:${idPart(doc.id)}:${idPart(locator)}`, text(locator), 'evidence', segment && parsed ? 'normal' : 'pending', segment && parsed ? segment.text : '当前解析结果中未找到可读的对应位置，需核实原件定位。', { documentId: doc.id, locator, action: { type: 'document', documentId: doc.id, locator } });
          edge(from, anchor, '证据位置', anchor.status);
          edge(anchor, node, '来自原件', anchor.status);
        }
        return node;
      };
      const validAnchor = (documentId, locator) => {
        const doc = documents.get(documentId);
        return Boolean(doc && doc.status === 'parsed' && text(locator) && list(doc.segments).some(s => s && text(s.locator) === text(locator) && text(s.text)));
      };
      const policy = cn('policy', '企业制度要求', 'policy', data.requirementConfirmed === true && validAnchor(data.policyDocumentId, data.policyLocator) ? (currentStatus === 'not_applicable' ? 'not_applicable' : 'normal') : 'pending', [`制度要求：${data.requirementConfirmed === true ? '人工已确认' : '待确认'}`, `适用性：${data.applicability === 'applicable' ? '适用' : data.applicability === 'not_applicable' ? '申明不适用' : '待核实'}`, `启用前培训：${data.beforeUseRequired === true ? '要求' : data.beforeUseRequired === false ? '未要求' : '待核实'}`, `考核：${data.assessmentRequired === true ? '要求' : data.assessmentRequired === false ? '未要求' : '待核实'}`, text(data.applicabilityNote)].filter(Boolean).join('\n'));
      edge(task, policy, '采用依据', policy.status);
      documentRef(data.policyDocumentId, policy, '制度原件', data.policyLocator);
      if (currentStatus === 'not_applicable') {
        const reason = cn('not-applicable', '本项关联要求不适用', 'finding', 'not_applicable', text(data.applicabilityNote) || text(evaluation?.reason), { action: { type: 'case', caseId } });
        edge(task, reason, '不适用说明', 'not_applicable');
        return;
      }
      const procedure = cn('procedure', text(data.procedureNumber) || '规程编号待确认', 'procedure', text(data.procedureNumber) && validAnchor(data.procedureDocumentId, data.procedureLocator) ? 'normal' : 'pending', `本工作规程。启用状态：${data.inUse === true ? '已启用' : data.inUse === false ? '未启用' : '待确认'}；启用日期：${text(data.effectiveDate) || '待确认'}。`);
      edge(task, procedure, '变更对象', procedure.status);
      documentRef(data.procedureDocumentId, procedure, '规程原件', data.procedureLocator);
      const version = cn('version', text(data.version) ? `目标版本 ${data.version}` : '目标版本待确认', 'version', text(data.version) ? 'normal' : 'pending', '仅按本次确认的目标版本核对培训；旧版本不能自动替代新版本。');
      edge(procedure, version, '本次版本', version.status);
      const people = list(data.people).filter(p => p && typeof p === 'object');
      const roster = cn('roster', `受影响人员 · ${people.length} 人`, 'roster', people.length && validAnchor(data.rosterDocumentId, data.rosterLocator) ? 'normal' : 'pending', '人数来自本工作已保存的名单；按稳定人员编号匹配，不仅按姓名。');
      edge(task, roster, '影响范围', roster.status);
      documentRef(data.rosterDocumentId, roster, '名单原件', data.rosterLocator);
      const coverage = data.coverage || {}, sources = list(coverage.sourceDocumentIds).filter(id => typeof id === 'string');
      const sourceComplete = sources.length > 0 && sources.every(id => { const doc = documents.get(id); return doc && doc.status === 'parsed' && doc.partial !== true; });
      const coverageKnown = coverage.status === 'complete' && text(coverage.from) && text(coverage.to) && text(coverage.note) && sourceComplete;
      const cov = cn('coverage', coverageKnown ? '已声明完整覆盖范围' : '资料覆盖待核实', 'coverage', coverageKnown ? 'normal' : 'pending', [`所列期间：${text(coverage.from) || '待确认'} 至 ${text(coverage.to) || '待确认'}`, text(coverage.note), '覆盖状态来自本工作保存的声明与原件提取状态；不代表系统已检查所有企业资料。'].filter(Boolean).join('\n'));
      edge(task, cov, '核对范围', cov.status);
      sources.forEach(id => documentRef(id, cov, '覆盖来源'));
      if (!sources.length) documentRef('', cov, '覆盖来源');
      const matched = new Map(list(evaluation?.matchedPeople).filter(p => p && text(p.id)).map(p => [p.id, p]));
      const missing = new Map(list(evaluation?.missingPeople).filter(p => p && text(p.id)).map(p => [p.id, p]));
      const personNodes = new Map();
      people.forEach((person, personIndex) => {
        const stableId = text(person.id), match = matched.get(stableId), miss = missing.get(stableId);
        const status = currentStatus === 'not_applicable' ? 'not_applicable' : match ? (match.late && history.length ? 'historical' : 'normal') : miss && currentStatus === 'gap' ? 'gap' : 'pending';
        const personNode = cn(`person:${idPart(stableId || `unknown-${personIndex}`)}`, `${text(person.name) || '姓名待确认'}${stableId ? ` · ${stableId}` : ''}`, 'person', status, match ? `本次评价已匹配记录 ${match.trainingId}。${match.late ? '该记录晚于启用时间，需结合历史问题查看。' : ''}` : miss ? miss.reason : '本次评价尚无此人的有效匹配结论；不能据此认定实际未培训。', { personId: stableId });
        if (stableId) personNodes.set(stableId, personNode);
        edge(roster, personNode, '受影响人员', status);
        if (miss) {
          const requirement = cn(`requirement:${idPart(stableId || personIndex)}`, `对应版本材料${status === 'gap' ? '缺口' : '待核实'}`, 'requirement', status === 'gap' ? 'gap' : status === 'not_applicable' ? 'not_applicable' : 'pending', `${miss.reason || '本次评价未匹配记录'}。记录缺口不证明实际未开展培训。`);
          edge(personNode, requirement, '应有培训证据', requirement.status);
          edge(version, requirement, '所需版本', requirement.status);
        }
      });
      list(data.training).filter(record => record && typeof record === 'object').forEach((record, recordIndex) => {
        const match = list(evaluation?.matchedPeople).find(p => p && p.id === record.personId && p.trainingId === record.id);
        const parent = personNodes.get(record.personId) || roster;
        const status = currentStatus === 'not_applicable' ? 'not_applicable' : !validAnchor(record.documentId, record.locator) ? 'pending' : match ? (match.late && history.length ? 'historical' : 'normal') : 'pending';
        const associatedPerson = text(record.personId) ? people.find(person => text(person.id) === text(record.personId)) : null;
        const personLabel = associatedPerson ? text(associatedPerson.name) || text(associatedPerson.id) : '';
        const trainingLabel = readableRecordId(record.recordId) || readableRecordId(record.id) || [personLabel ? `${personLabel}培训` : '培训记录', text(record.date)].filter(Boolean).join(' · ');
        const training = cn(`training:${idPart(text(record.id) || `unidentified-${recordIndex}`)}`, trainingLabel, 'training', status, [`内部记录ID：${text(record.id) || '待确认'}`, `人员编号：${text(record.personId) || '待确认'}`, `版本：${text(record.version) || '待确认'}`, `实际培训日：${text(record.date) || '待确认'}`, `考核：${record.passed === true ? '通过' : record.passed === false ? '未通过' : '待确认'}`, match ? '本次评价已匹配此记录。' : '本记录尚未被本次评价采用；请查看版本、对象、日期及证据位置。'].join('\n'), { trainingId: text(record.id), personId: text(record.personId) });
        edge(parent, training, '培训记录', status);
        if (text(record.version) === text(data.version) && text(data.version)) edge(training, version, '记录版本对应', match ? status : 'pending');
        else if (text(record.version)) {
          const recordVersion = cn(`record-version:${idPart(record.version)}`, `记录版本 ${record.version}`, 'version', 'pending', '该记录版本与本次目标版本不同；不会自动满足本次培训要求。');
          edge(training, recordVersion, '所记版本', 'pending');
        }
        documentRef(record.documentId, training, '实施记录原件', record.locator);
      });
      list(evaluation?.findings).filter(f => f && typeof f === 'object').forEach((finding, findingIndex) => {
        let status = knownStatus(finding.status);
        if (status === 'complete') status = 'normal';
        if (status === 'gap' && currentStatus === 'pending') status = 'pending';
        const node = cn(`finding:${idPart(text(finding.key) || findingIndex)}`, text(finding.title) || '本次关联检查', 'finding', status, [finding.detail, finding.nextAction ? `下一步：${finding.nextAction}` : ''].filter(Boolean).join('\n'), { action: { type: 'case', caseId } });
        edge(task, node, '评价发现', status);
        list(finding.documentIds).forEach(id => documentRef(id, node, '所引材料'));
      });
      history.forEach((entry, historyIndex) => {
        const node = cn(`history:${historyIndex}`, `历史时点问题 ${historyIndex + 1}`, 'historical', 'historical', plain(entry), { action: { type: 'case', caseId } });
        edge(task, node, '保留历史问题', 'historical');
      });
      list(evaluation?.archiveLinks).filter(link => link && documents.has(link.documentId) && Object.hasOwn(archiveLabels, link.element)).forEach(link => {
        const archive = cn(`archive:${link.element}`, archiveLabels[link.element], 'archive', currentStatus === 'not_applicable' ? 'not_applicable' : 'normal', '仅展示本次已保存评价中的真实档案关联；目录填充不代表标准化达标。', { element: link.element, action: { type: 'case', caseId } });
        edge(task, archive, '档案归属');
        const original = documentRef(link.documentId, archive, '已关联原件');
        const edgeId = `edge:${idPart(archive.id)}:${idPart(original.id)}:${idPart('已关联原件')}`;
        if (linkMap.has(edgeId)) Object.assign(linkMap.get(edgeId), { archiveLink: true, detail: text(link.reason) });
      });
      if (currentStatus === 'complete' && !history.length && [...nodeMap.values()].some(n => n.caseId === caseId && n.status === 'pending')) {
        task.status = 'pending'; task.color = COLORS.pending;
        task.detail += '\n已保存评价为当前材料齐备，但图中仍有未解析/未核实资料；请核对具体节点。本视图不改写原评价。';
        const projectEdge = [...linkMap.values()].find(link => link.source === projectNodeId && link.target === task.id);
        if (projectEdge) { projectEdge.status = 'pending'; projectEdge.color = COLORS.pending; }
      }
    });
    // Design review is its own evidence group, never an invented business case.
    const review = snapshot && snapshot.designReview;
    const source = review?.status === 'available' ? documents.get(review.sourceDocumentId) : null;
    if (source && source.status === 'parsed' && (!review.sourceVersion || !source.sha256 || review.sourceVersion === source.sha256)) {
      const groupId = `design-review:${idPart(source.id)}`, baseColor = COLORS.groups[cases.length % COLORS.groups.length];
      allGroups.push({ id: groupId, kind: 'design_review', label: '专篇初评与建设范围', color: baseColor });
      const dn = (suffix, label, kind, status = 'normal', detail = '', extra = {}) => addNode({ id: `${groupId}:${suffix}`, groupId, label, kind, status, detail, color: colorFor(status, baseColor), ...extra });
      const de = (from, to, label, status = 'normal', extra = {}) => addLink(from.id || from, to.id || to, label, status, baseColor, { groupId, ...extra });
      const root = dn('review', '专篇初评 · 待人工核对', 'design_review', 'normal', text(review.boundary) || '按已提取原文整理设计范围与待核事项；不代表现状核验或合规结论。');
      de(projectNodeId, root, '建设资料初评');
      const designDoc = doc => {
        usedDocumentIds.add(doc.id);
        return dn(`document:${idPart(doc.id)}`, text(doc.name) || '设计来源原件', 'document', doc.status === 'parsed' && !doc.partial ? 'normal' : 'pending', `来源原件。${doc.partial ? '仅提取部分内容。' : ''}设计描述与实际运行状态分别核对。`, { documentId: doc.id, action: { type: 'document', documentId: doc.id } });
      };
      de(root, designDoc(source), '来源原件');
      const validEvidence = entries => list(entries).flatMap(entry => {
        const doc = documents.get(entry?.documentId);
        const segment = doc?.status === 'parsed' ? list(doc.segments).find(s => s && text(s.locator) === text(entry.locator) && text(s.text)) : null;
        if (!segment) return [];
        const quote = text(entry.quote);
        return [{ doc, locator: segment.locator, quote: quote && segment.text.includes(quote) ? quote : segment.text }];
      });
      const evidence = (from, entries) => validEvidence(entries).forEach(entry => {
        const anchor = dn(`anchor:${idPart(entry.doc.id)}:${idPart(entry.locator)}`, entry.locator, 'evidence', 'normal', entry.quote, { documentId: entry.doc.id, locator: entry.locator, action: { type: 'document', documentId: entry.doc.id, locator: entry.locator } });
        de(from, anchor, '原文依据'); de(anchor, designDoc(entry.doc), '来自原件');
      });
      list(review.facts).filter(f => f && validEvidence(f.evidence).length).forEach((fact, index) => {
        const node = dn(`fact:${idPart(text(fact.id) || index)}`, text(fact.title) || '设计原文描述', 'design_fact', 'normal', `${text(fact.value)}\n这是来源文件中的设计描述，当前实际状态待核对。`);
        de(root, node, '原文整理'); evidence(node, fact.evidence);
      });
      const findingNodes = [];
      list(review.findings).filter(f => f && validEvidence(f.evidence).length).forEach((finding, index) => {
        const refs = validEvidence(finding.evidence), first = refs[0];
        const node = dn(`finding:${idPart(text(finding.id) || index)}`, text(finding.title) || '专篇原文待核事项', 'design_finding', 'review_pending', [text(finding.detail), text(finding.nextAction) ? `下一步：${text(finding.nextAction)}` : '', '红色表示需要优先核对的原文事项，不是违法、未履职或现场风险结论。'].filter(Boolean).join('\n'), { findingId: text(finding.id), issueKind: text(finding.issueKind), separationId: text(finding.separationId), documentId: first.doc.id, locator: first.locator, action: { type: 'document', documentId: first.doc.id, locator: first.locator } });
        de(root, node, '原文待核', 'review_pending'); evidence(node, finding.evidence);
        findingNodes.push({ node, finding });
        list(finding.citedStandards).filter(standard => text(standard) && refs.some(ref => ref.quote.includes(standard))).forEach(standard => {
          const reference = dn(`standard:${idPart(standard)}`, standard, 'standard_reference', 'pending', '专篇引用的规范与条款，现行版本、适用条件和测量基准仍需核对。此节点只表示原文引用，不是系统已确认的现行执行要求。', { documentId: first.doc.id, locator: first.locator, action: { type: 'document', documentId: first.doc.id, locator: first.locator } });
          de(node, reference, '原文引用 · 待复核', 'pending');
        });
      });
      list(review.requests).filter(r => r && text(r.title)).forEach((request, index) => {
        const received = request.status === 'provided';
        const node = dn(`request:${idPart(text(request.id) || index)}`, request.title, 'material_request', received ? 'normal' : 'pending', `${received ? '已收到该类别原件，内容充分性与现行有效性待核对。' : '当前项目尚未提供该类别资料，不等于企业未开展相关工作。'}\n${text(request.reason)}`);
        de(root, node, received ? '已收到类别原件' : '待补运行资料', node.status);
      });
      list(review.archiveLinks).filter(link => link && documents.has(link.documentId) && Object.hasOwn(archiveLabels, link.element)).forEach(link => {
        const archive = dn(`archive:${link.element}`, archiveLabels[link.element], 'archive', 'normal', `${text(link.reason)}\n专篇参考归档，内容充分性与适用性待核；不代表要素完成或标准化达标。`, { documentId: link.documentId, element: link.element, referenceOnly: true, action: { type: 'document', documentId: link.documentId } });
        de(root, archive, '专篇参考归档');
        de(archive, designDoc(documents.get(link.documentId)), '参考原件', 'normal', { archiveLink: true, referenceOnly: true });
      });
      const facility = snapshot.facility;
      if (facility && (!facility.projectId || facility.projectId === projectId)) list(facility.units).filter(unit => unit && text(unit.id) && (!unit.projectId || unit.projectId === projectId) && validEvidence([{ documentId: unit.documentId, locator: unit.locator }]).length).forEach(unit => {
        const node = dn(`unit:${idPart(unit.id)}`, text(unit.name) || '建设单元', 'facility_unit', unit.confirmed === true ? 'normal' : 'pending', [text(unit.kind), text(unit.capacity || unit.raw), unit.confirmed === true ? '建设登记已人工核对。' : '建设登记待人工核对。', '单元位置为管理示意；存在设计单元不代表已经投产、当前有作业或现场安全。'].filter(Boolean).join('\n'), { documentId: unit.documentId, locator: unit.locator, action: { type: 'document', documentId: unit.documentId, locator: unit.locator } });
        de(root, node, '已登记建设单元', node.status); evidence(node, [{ documentId: unit.documentId, locator: unit.locator, quote: unit.excerpt }]);
      });
      findingNodes.forEach(({node, finding}) => list(finding.relatedUnitIds).forEach(unitId => {
        const unitNode = nodeMap.get(`${groupId}:unit:${idPart(unitId)}`);
        const unit = list(facility?.units).find(u => u.id === unitId);
        if (unitNode && unit?.documentId === source.id && unit.sourceVersion === source.sha256) de(node, unitNode, '涉及装置 · 待核', 'review_pending');
      }));
    }
    // Real documents that have no work reference remain visible in the enterprise view.
    documents.forEach(doc => {
      if (usedDocumentIds.has(doc.id)) return;
      const status = doc.status === 'parsed' && doc.partial !== true ? 'normal' : 'pending';
      const node = addNode({ id: `unassigned-document:${idPart(doc.id)}`, label: text(doc.name) || '已保存原件', kind: 'document', documentId: doc.id, status, color: colorFor(status, COLORS.neutral), detail: `已保存的企业原件，尚未关联到图中工作。${doc.partial ? '当前只提取部分内容，不能证明资料完整。' : ''}`, action: { type: 'document', documentId: doc.id } });
      addLink(projectNodeId, node.id, '未关联工作原件', status, COLORS.neutral);
    });
    const allNodes = [...nodeMap.values()], allLinks = [...linkMap.values()];
    let selectedCases = new Set(allGroups.map(group => group.id));
    if (opt.scope === 'case') selectedCases = new Set(selectedCases.has(opt.caseId) ? [opt.caseId] : []);
    if (opt.status === 'issues') selectedCases = new Set([...selectedCases].filter(id => allNodes.some(node => nodeGroup(node) === id && isIssue(node.status))));
    const query = text(opt.query).toLocaleLowerCase();
    const matches = node => !query || [node.label, node.detail, node.locator, node.personId, node.trainingId, node.documentId].filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
    if (query) selectedCases = new Set([...selectedCases].filter(id => allNodes.some(node => nodeGroup(node) === id && matches(node))));
    const visibleUnassigned = allNodes.filter(node => !nodeGroup(node) && node.kind === 'document' && opt.scope !== 'case' && (opt.status !== 'issues' || isIssue(node.status)) && matches(node));
    const ids = new Set(allNodes.filter(node => nodeGroup(node) && selectedCases.has(nodeGroup(node))).map(node => node.id));
    visibleUnassigned.forEach(node => ids.add(node.id));
    if (ids.size && nodeMap.has(projectNodeId)) ids.add(projectNodeId);
    const nodes = allNodes.filter(node => ids.has(node.id)).map(node => ({ ...node, ...(node.action ? { action: { ...node.action } } : {}) }));
    const links = allLinks.filter(link => ids.has(link.source) && ids.has(link.target)).map(link => ({ ...link }));
    const groups = allGroups.filter(group => selectedCases.has(group.id)).map(group => ({ ...group }));
    const current = [...selectedCases].map(id => caseMeta.get(id)).filter(Boolean);
    return {
      nodes, links, groups,
      counts: {
        nodes: nodes.length, links: links.length, cases: current.length, designReviews: groups.filter(g => g.kind === 'design_review').length, constructionUnits: nodes.filter(n => n.kind === 'facility_unit').length,
        documents: new Set(nodes.filter(node => node.kind === 'document').map(node => node.documentId)).size,
        people: new Set(nodes.filter(node => node.kind === 'person' && node.personId).map(node => node.personId)).size,
        personNodes: nodes.filter(node => node.kind === 'person').length,
        trainingRecords: nodes.filter(node => node.kind === 'training').length,
        archiveLinks: links.filter(link => link.archiveLink).length,
        gapCases: current.filter(meta => meta.currentStatus === 'gap').length,
        pendingCases: current.filter(meta => meta.currentStatus === 'pending').length,
        completeCases: current.filter(meta => meta.currentStatus === 'complete').length,
        notApplicableCases: current.filter(meta => meta.currentStatus === 'not_applicable').length,
        historicalCases: current.filter(meta => meta.history > 0).length,
        issueNodes: nodes.filter(node => isIssue(node.status)).length,
        gapNodes: nodes.filter(node => node.status === 'gap').length,
        pendingNodes: nodes.filter(node => node.status === 'pending').length,
        historicalNodes: nodes.filter(node => node.status === 'historical').length,
        designReviewNodes: nodes.filter(node => node.status === 'review_pending').length,
        totalCases: cases.length, totalNodes: allNodes.length, totalLinks: allLinks.length, totalDocuments: documents.size,
      },
    };
  }
  return Object.freeze({ build, COLORS });
});
