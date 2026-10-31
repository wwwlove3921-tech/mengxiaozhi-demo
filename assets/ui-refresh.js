/* Original vanilla JS interactions for Meng Xiaozhi.
 * Design references: satnaing/shadcn-admin search.tsx (command entry),
 * magicuidesign/magicui blur-fade.tsx (one-time entrance).
 * No framework or upstream component code is bundled. No API/data mutations.
 */
(() => {
  'use strict';
  if (document.getElementById('ui-command')) return;
  document.body.classList.add('ui-refresh');
  const searchSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
  const jumpSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>';
  const descriptions = {
    home: '今日重点、资料反馈与下一步行动',
    enterprise: '企业项目、上传原件与提取结果',
    regulations: '法规来源与企业收到的监管文件',
    duties: '规程、人员、培训及依据关联核对',
    archives: 'AQ/T 3034 的 20 要素档案目录',
    graph: '探索工作、依据与证据之间的关系',
    facility: '建设单元、承包商与作业票监督沙盘',
    reporting: '政府平台及上报接入准备',
    scene: '厂区、人员和现场作业接入准备'
  };
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const topbar = document.querySelector('.topbar');
  const topbarLeft = document.querySelector('.topbar-left');
  if (!topbar) return;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'ui-command-trigger';
  trigger.setAttribute('aria-label', '跳转与查找工作区');
  trigger.setAttribute('aria-keyshortcuts', 'Meta+K Control+K');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.innerHTML = `${searchSvg}<span>跳转与查找…</span><kbd>${isMac ? '⌘' : 'Ctrl'} K</kbd>`;
  topbar.insertBefore(trigger, document.querySelector('.topbar-right'));
  const mobileBrand = document.createElement('span');
  mobileBrand.className = 'ui-mobile-product';
  mobileBrand.textContent = '蒙小智';
  topbarLeft?.appendChild(mobileBrand);

  const dialog = document.createElement('dialog');
  dialog.id = 'ui-command';
  dialog.setAttribute('aria-labelledby', 'ui-command-title');
  dialog.innerHTML = `<h2 class="ui-a11y-only" id="ui-command-title">跳转与查找工作区</h2>
    <div class="ui-command-header">${searchSvg}<input id="ui-command-input" type="search" role="combobox" aria-label="搜索模块或当前页记录" aria-autocomplete="list" aria-controls="ui-command-list" aria-expanded="true" autocomplete="off" placeholder="想去哪里，或者找什么？"><button class="ui-command-close" type="button" aria-label="关闭查找">ESC</button></div>
    <p class="ui-command-scope">查找 9 个功能模块与当前页可见的工作、资料</p>
    <div id="ui-command-list" class="ui-command-list" role="listbox" aria-label="查找结果"></div>
    <p id="ui-command-announcement" class="ui-a11y-only" role="status" aria-live="polite"></p>
    <footer class="ui-command-footer"><span><kbd>↑ ↓</kbd> 选择　<kbd>↵</kbd> 打开</span><span>原件全文请在企业资料中查看</span></footer>`;
  document.body.appendChild(dialog);
  const input = dialog.querySelector('input');
  const list = dialog.querySelector('.ui-command-list');
  const announcement = dialog.querySelector('[role=status]');
  let commands = [];
  let visible = [];
  let selected = 0;
  let previousFocus;

  function collectCommands() {
    const result = [...document.querySelectorAll('.nav-item[data-nav]')].map(link => ({
      title: link.querySelector('span')?.textContent.trim() || link.textContent.trim(),
      description: descriptions[link.dataset.nav] || '打开功能模块',
      svg: link.querySelector('svg')?.outerHTML || jumpSvg,
      element: link,
      keywords: link.dataset.nav
    }));
    const seen = new Set();
    for (const element of document.querySelectorAll('#page-content .lw-case-row[data-action="lw-case-open"], #page-content .lw-doc-name>button[data-action="lw-document"]')) {
      const title = (element.querySelector('b')?.textContent || element.textContent).trim();
      const key = `${element.dataset.action}|${element.dataset.id}`;
      if (!title || seen.has(key)) continue;
      seen.add(key);
      result.push({ title, description: element.dataset.action === 'lw-case-open' ? '当前页工作 · 打开核对记录' : '当前页资料 · 查看原件与提取内容', svg: jumpSvg, element, keywords: '' });
    }
    return result;
  }
  function setSelection(next, scroll = true) {
    selected = visible.length ? (next + visible.length) % visible.length : 0;
    for (const [index, item] of [...list.children].entries()) {
      if (item.getAttribute('role') === 'option') item.setAttribute('aria-selected', String(index === selected));
    }
    const active = document.getElementById(`ui-command-option-${selected}`);
    if (active) {
      input.setAttribute('aria-activedescendant', active.id);
      if (scroll) active.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function filterCommands() {
    const query = input.value.trim().toLocaleLowerCase();
    visible = commands.filter(item => `${item.title} ${item.description} ${item.keywords}`.toLocaleLowerCase().includes(query));
    list.innerHTML = visible.length ? visible.map((item,index) => `<div id="ui-command-option-${index}" class="ui-command-option" role="option" data-command-index="${index}" aria-selected="${index === 0}">${item.svg}<span><strong>${e(item.title)}</strong><small>${e(item.description)}</small></span><kbd aria-hidden="true">↵</kbd></div>`).join('') : '<p class="ui-command-empty">没有找到匹配项，试试“资料”“培训”或“图谱”。</p>';
    announcement.textContent = `${visible.length} 个结果`;
    setSelection(0, false);
  }
  function openCommand() {
    if (dialog.open) { dialog.close(); return; }
    // Let an existing business form keep its focus and draft state.
    if (document.querySelector('dialog[open]')) return;
    commands = collectCommands();
    previousFocus = document.activeElement;
    input.value = '';
    filterCommands();
    dialog.showModal();
    input.focus();
  }
  function activate(index) {
    const item = visible[index];
    if (!item?.element?.isConnected) return;
    dialog.close();
    // Existing app navigation/handlers retain all validation and data behavior.
    item.element.click();
  }
  trigger.addEventListener('click', openCommand);
  dialog.querySelector('.ui-command-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', event => {
    const item = event.target.closest('[data-command-index]');
    if (item) activate(Number(item.dataset.commandIndex));
    else if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  });
  list.addEventListener('pointermove', event => {
    const item = event.target.closest('[data-command-index]');
    if (item) setSelection(Number(item.dataset.commandIndex), false);
  });
  input.addEventListener('input', filterCommands);
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setSelection(selected + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter') { event.preventDefault(); activate(selected); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dialog.close(); }
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault(); openCommand();
    }
  });

  const sidebar = document.querySelector('.sidebar');
  const menu = document.querySelector('[data-action=menu]');
  const compactLayout = window.matchMedia('(max-width:850px)');
  function syncNavigationAccess() {
    const open = document.body.classList.contains('sidebar-open');
    const hidden = compactLayout.matches && !open;
    if (sidebar) {
      if (hidden && sidebar.contains(document.activeElement)) menu?.focus({ preventScroll: true });
      sidebar.inert = hidden;
      if (hidden) sidebar.setAttribute('aria-hidden','true');
      else sidebar.removeAttribute('aria-hidden');
    }
    menu?.setAttribute('aria-expanded',String(open));
  }
  compactLayout.addEventListener('change',syncNavigationAccess);
  new MutationObserver(syncNavigationAccess).observe(document.body,{attributes:true,attributeFilter:['class']});
  syncNavigationAccess();

  const page = document.getElementById('page-content');
  // One motion layer at a time: cards can contain rows, but never scale together.
  const cardSelector = [
    '.card', '.metric-card', '.ops-metric', '.archive-tile', '.archive-main-tile',
    '.element-card', '.graph-task-card', '.lw-case-row', '.lw-doc-row',
    '.lw-finding-link', '.lw-finding', '.lw-model-row', '.lw-platforms>div',
    '.task-row', '.risk-item', '.lw-project-choices>button', '.lw-hero', '.hero',
    '.archive-standard-hero', '.lw-onboarding-intro', '.mxg-inspector',
    '.mxg-issue-preview>button', '.mxg-node-list>button', '[data-ui-card]'
  ].join(',');
  const rowSelector = '.lw-case-row,.lw-doc-row,.lw-finding-link,.task-row,.risk-item,.mxg-issue-preview>button,.mxg-node-list>button';
  const stationarySelector = 'form,input,select,textarea,[contenteditable]:not([contenteditable="false"]),canvas';
  function prepareCard(element) {
    if (!(element instanceof HTMLElement)) return;
    const explicit = element.hasAttribute('data-ui-card');
    const optedOut = ['off','false'].includes(element.getAttribute('data-ui-card'));
    // New sandbox surfaces opt in only their information cards, never a scene.
    const inSandbox = Boolean(element.closest('[class^="mxf-"],[class*=" mxf-"]'));
    if (optedOut || (inSandbox && !explicit)) {
      element.classList.remove('ui-card-motion','ui-card-static','ui-card-row');
      return;
    }
    const stationary = Boolean(
      element.closest('form,.mxg-stage-wrap,.mxg-stage,.lw-graph-canvas,.map-card') ||
      element.matches(stationarySelector) || element.querySelector(stationarySelector)
    );
    element.classList.toggle('ui-card-static',stationary);
    element.classList.toggle('ui-card-motion',!stationary);
    element.classList.toggle('ui-card-row',element.matches(rowSelector));
  }
  function prepareCards(root) {
    if (root?.matches?.(cardSelector)) prepareCard(root);
    root?.querySelectorAll(cardSelector).forEach(prepareCard);
  }
  function preparePointerPath(target) {
    if (!(target instanceof Element) || !page?.contains(target)) return;
    for (let card = target.closest(cardSelector); card && page.contains(card); card = card.parentElement?.closest(cardSelector)) prepareCard(card);
  }
  // Lazy registration covers inspector/list refreshes without observing canvas frames.
  document.addEventListener('pointerover',event => {
    if (event.pointerType === 'mouse') document.body.classList.remove('ui-touch-input');
    preparePointerPath(event.target);
  },{passive:true});
  document.addEventListener('pointerdown',event => {
    if (event.pointerType === 'touch') document.body.classList.add('ui-touch-input');
  },{passive:true});
  document.addEventListener('focusin',event => preparePointerPath(event.target));

  const seenSections = new WeakSet();
  function enhancePage() {
    let index = 0;
    for (const child of page.children) {
      if (seenSections.has(child)) continue;
      seenSections.add(child);
      // Never animate the graph renderer or any of its internals.
      if (!child.matches('.welcome-row,.lw-hero,.lw-metrics,.lw-two-column,.lw-panel,.lw-onboarding,.lw-project-summary,.lw-unconnected,.archive-standard-hero,.element-grid')) continue;
      child.classList.add('ui-enter');
      child.style.setProperty('--ui-delay', `${Math.min(index++,5) * 35}ms`);
    }
    prepareCards(page);
    document.querySelectorAll('.nav-item[data-nav]').forEach(link => {
      if (link.dataset.nav === (location.hash.slice(1) || 'home')) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
  }
  // Direct route replacements only; the graph may update its own DOM every frame.
  if (page) { new MutationObserver(enhancePage).observe(page, { childList: true }); enhancePage(); }
  window.addEventListener('hashchange', () => { if (dialog.open) dialog.close(); });

  // Feedback follows the real disabled state, never pretends a request succeeded.
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.id.startsWith('lw-')) return;
    const button = event.submitter || form.querySelector('button[type=submit]');
    if (!button) return;
    queueMicrotask(() => {
      if (!button.disabled || !button.isConnected) return;
      button.classList.add('ui-is-loading');
      button.setAttribute('aria-busy','true');
      const observer = new MutationObserver(() => {
        if (!button.disabled) { button.classList.remove('ui-is-loading'); button.removeAttribute('aria-busy'); observer.disconnect(); }
      });
      observer.observe(button,{attributes:true,attributeFilter:['disabled']});
      // Route replacement may remove the button before its request completes.
      setTimeout(() => observer.disconnect(),60000);
    });
  },true);
})();
