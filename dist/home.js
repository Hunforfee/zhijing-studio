(() => {
  // Keep existing bookmarked workspace anchors working after adding a homepage.
  const workspaceAnchors = new Set(['creationPanel', 'results', 'imageDesignWorkspace', 'detailPageModule', 'detailDesignWorkspace', 'videoDesignModule', 'videoDesignWorkspace', 'freeCreationWorkspace']);
  if (workspaceAnchors.has(location.hash.slice(1))) { location.replace('/workspace' + location.search + location.hash); return; }
  const menu = document.getElementById('menuToggle'), nav = document.getElementById('siteNav');
  if (!menu || !nav) return;
  const closeMenu = () => { menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', '展开导航'); nav.classList.remove('is-open'); };
  menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? '收起导航' : '展开导航'); nav.classList.toggle('is-open', open); });
  nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); } });
  document.addEventListener('click', event => { if (!event.target.closest('.header-inner')) closeMenu(); });
  matchMedia('(min-width: 721px)').addEventListener('change', closeMenu);
})();
