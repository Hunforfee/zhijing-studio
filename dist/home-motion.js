(() => {
  const toggle = document.getElementById('homeMotionToggle');
  if (!toggle) return;
  const label = toggle.querySelector('.motion-toggle-label') || toggle;
  const icon = toggle.querySelector('.motion-toggle-icon');

  const storageKey = 'zhijing-home-motion-v1';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const visuals = [...document.querySelectorAll('[data-home-motion]')];
  const visible = new WeakMap(visuals.map(element => [element, true]));
  let manuallyPaused = false;
  try { manuallyPaused = localStorage.getItem(storageKey) === 'paused'; } catch {}

  function sync() {
    const paused = manuallyPaused || reducedMotion.matches;
    const inactive = paused || document.hidden;
    document.documentElement.dataset.homeMotionState = inactive ? 'paused' : 'running';
    document.documentElement.style.setProperty('--home-motion-state', inactive ? 'paused' : 'running');
    for (const element of visuals) {
      element.style.setProperty('--home-motion-state', inactive || visible.get(element) === false ? 'paused' : 'running');
    }
    toggle.disabled = reducedMotion.matches;
    toggle.setAttribute('aria-pressed', String(paused));
    label.textContent = reducedMotion.matches ? '已减少动态' : manuallyPaused ? '播放动态' : '暂停动态';
    if (icon) icon.textContent = reducedMotion.matches ? '—' : manuallyPaused ? '▷' : 'Ⅱ';
    toggle.setAttribute('aria-label', reducedMotion.matches ? '已跟随系统设置减少动态' : manuallyPaused ? '播放首页动态效果' : '暂停首页动态效果');
    toggle.title = reducedMotion.matches ? '已跟随系统的减少动态设置' : '只影响首页展示效果';
  }

  toggle.addEventListener('click', () => {
    if (reducedMotion.matches) return;
    manuallyPaused = !manuallyPaused;
    try { localStorage.setItem(storageKey, manuallyPaused ? 'paused' : 'running'); } catch {}
    sync();
  });
  reducedMotion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('storage', event => {
    if (event.key === storageKey) {
      manuallyPaused = event.newValue === 'paused';
      sync();
    }
  });

  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
    sync();
  }, {rootMargin:'80px', threshold:0}) : null;
  function observe() { visuals.forEach(element => observer?.observe(element)); sync(); }
  window.addEventListener('pagehide', () => observer?.disconnect());
  window.addEventListener('pageshow', observe);
  observe();
})();
