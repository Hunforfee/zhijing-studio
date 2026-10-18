(() => {
  const creation = document.getElementById('creationPanel');
  const images = document.getElementById('results');
  if (!creation || !images) return;
  const icons = [
    '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/>',
    '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
    '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h8M8 18h5"/>',
    '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3z"/>'
  ];
  const nav = document.createElement('nav');
  nav.className = 'floating-workspace-nav';
  nav.setAttribute('aria-label', '工作区导航');
  const ids = ['creationPanel', 'results', 'detailPageModule', 'videoDesignModule'];
  const names = ['拍摄设置', '图片设计', '详情设计', '视频设计'];
  const shortNames = ['拍摄', '图片', '详情', '视频'];
  nav.classList.add('workspace-docked-nav');
  const leaf = '<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M15 16C6 17 3 11 4 5c7 0 12 4 11 11M18 17C16 8 21 3 28 3c1 7-3 13-10 14M15 20C7 18 2 22 3 27c7 3 12 0 12-7M18 21c1-6 6-9 12-8 0 7-5 12-12 8"/><path d="M16 13v17" stroke="currentColor" stroke-width="2"/></svg>';
  nav.innerHTML = `<div class="workspace-nav-brand">${leaf}</div><div class="workspace-nav-links" id="workspaceNavLinks">` + names.map((name, i) => `<a href="#${ids[i]}" aria-label="${name}" title="${name}" ${i === 0 ? 'aria-current="location"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[i]}</svg><span>${shortNames[i]}</span></a>`).join('') + '</div><div class="workspace-nav-bottom"><button type="button" id="workspaceNavSettings" title="生成服务设置" aria-label="生成服务设置"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/></svg><span>设置</span></button></div>';
  nav.querySelector('a[href="#creationPanel"]')?.remove();
  document.body.append(nav);
  document.body.classList.add('has-workspace-navigation');
  document.getElementById('workspaceNavSettings').onclick = () => document.getElementById('settingsBtn')?.click();
  const guideKey = 'zhijing-workspace-nav-guide-v1';
  let guideDismissed = false;
  try { guideDismissed = localStorage.getItem(guideKey) === 'seen'; } catch {}
  if (!guideDismissed) {
    const guide = document.createElement('aside');
    guide.className = 'workspace-nav-guide';
    guide.setAttribute('aria-labelledby', 'workspaceNavGuideTitle');
    const descriptions = ['选产品与花型', '预览与编辑图片', '制作商品详情页', '制作商品展示视频'];
    guide.innerHTML = '<button type="button" class="nav-guide-close" aria-label="关闭导航说明">×</button><h3 id="workspaceNavGuideTitle">工作区入口</h3>' + names.map((name, i) => `<div class="nav-guide-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[i]}</svg><span><strong>${name}</strong><small>${descriptions[i]}</small></span></div>`).join('') + '<button type="button" class="nav-guide-done">知道了</button>';
    document.body.append(guide);
    function dismissGuide() {
      try { localStorage.setItem(guideKey, 'seen'); } catch {}
      guide.remove();
      document.removeEventListener('keydown', onGuideKey);
    }
    function onGuideKey(event) { if (event.key === 'Escape') dismissGuide(); }
    guide.querySelector('.nav-guide-close').onclick = dismissGuide;
    guide.querySelector('.nav-guide-done').onclick = dismissGuide;
    document.addEventListener('keydown', onGuideKey);
  }
  const creationHeader = creation.querySelector('.panel-title');
  creationHeader.classList.add('workspace-section-header');
  function addHeaderIcon(header, index) {
    const icon = document.createElement('span');
    icon.className = 'workspace-header-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[index]}</svg>`;
    header.prepend(icon);
  }
  addHeaderIcon(creationHeader, 0);
  const creationToggle = document.getElementById('toggleConfig');
  creationToggle.classList.add('workspace-section-toggle');
  const imageHeader = document.createElement('header');
  imageHeader.className = 'workspace-section-header';
  imageHeader.innerHTML = '<h2>图片设计</h2><button type="button" class="workspace-section-toggle" aria-expanded="true">收起 ↑</button>';
  images.prepend(imageHeader);
  addHeaderIcon(imageHeader, 1);
  const imageToggle = imageHeader.querySelector('button');
  imageToggle.onclick = () => {
    const collapsed = images.classList.toggle('workspace-section-collapsed');
    imageToggle.setAttribute('aria-expanded', String(!collapsed));
    imageToggle.textContent = collapsed ? '展开 ↓' : '收起 ↑';
    updateActive();
  };
  function syncCreation() {
    creationToggle.textContent = creation.classList.contains('is-collapsed') ? '展开 ↓' : '收起 ↑';
  }
  syncCreation();
  new MutationObserver(syncCreation).observe(creation, {attributes: true, attributeFilter: ['class']});
  function prepareDetail() {
    const detail = document.getElementById('detailPageModule');
    if (!detail || detail.dataset.navigationReady) return false;
    detail.dataset.navigationReady = 'true';
    const summary = detail.querySelector('summary');
    summary.classList.add('workspace-section-header');
    const title = document.createElement('h2');
    title.textContent = '详情设计';
    summary.querySelector('span').replaceWith(title);
    addHeaderIcon(summary, 2);
    const tip = summary.querySelector('small');
    if (tip) tip.remove();
    const toggle = document.createElement('span');
    toggle.className = 'workspace-section-toggle';
    summary.append(toggle);
    function syncDetail() {
      toggle.textContent = detail.open ? '收起 ↑' : '展开 ↓';
      summary.setAttribute('aria-expanded', String(detail.open));
      updateActive();
    }
    detail.addEventListener('toggle', syncDetail);
    syncDetail();
    return true;
  }
  if (!prepareDetail()) {
    const observer = new MutationObserver(() => { if (prepareDetail()) observer.disconnect(); });
    observer.observe(document.getElementById('workspace'), {childList: true});
  }
  function expand(id) {
    if (id === 'creationPanel' && creation.classList.contains('is-collapsed')) creationToggle.click();
    if (id === 'results' && images.classList.contains('workspace-section-collapsed')) imageToggle.click();
    if (id === 'detailPageModule') document.getElementById(id).open = true;
    if (id === 'videoDesignModule') document.getElementById(id).open = true;
  }
  nav.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    const id = link.hash.slice(1), target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    expand(id);
    const scrollTarget = id === 'videoDesignModule' ? document.getElementById('videoDesignWorkspace') || target : target;
    requestAnimationFrame(() => scrollTarget.scrollIntoView({block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}));
  });
  function updateActive() {
    let active = 1;
    ids.forEach((id, i) => {
      const section = document.getElementById(id === 'videoDesignModule' ? 'videoDesignWorkspace' : id);
      if (section && section.getBoundingClientRect().top <= 48) active = i;
    });
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = document.getElementById('videoDesignModule') ? ids.length - 1 : 2;
    nav.querySelectorAll('a').forEach(link => {
      if (link.hash === '#' + ids[active]) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {scheduled = false; updateActive();});
  };
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule);
  new ResizeObserver(schedule).observe(document.getElementById('workspace'));
  updateActive();
})();
