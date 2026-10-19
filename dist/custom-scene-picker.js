(() => {
  if (typeof state === 'undefined' || typeof renderSelections !== 'function') return;
  const host = document.querySelector('#shootSection .group-scenes');
  if (!host) return;
  const uuid = /^[a-f0-9-]{36}$/;
  const section = document.createElement('section');
  section.className = 'custom-scene-picker';
  section.setAttribute('aria-labelledby', 'customSceneTitle');
  section.innerHTML = '<header><h5 id="customSceneTitle">我的场景</h5><a href="/scenes">＋ 创建场景</a></header><p class="custom-scene-help">只参考房间与光线；选用后替换当前拍摄参考。</p><div id="customSceneChoices" class="custom-scene-choices"></div><div class="custom-scene-actions"><button type="button" id="refreshCustomScenes">刷新场景</button><button type="button" id="removeCustomScene" hidden>取消使用</button></div><p id="customSceneStatus" role="status" aria-live="polite"></p>';
  host.append(section);
  const list = section.querySelector('#customSceneChoices'), feedback = section.querySelector('#customSceneStatus');
  let scenes = [], loading = false, loadedAt = 0;
  const selectedId = () => state.referenceScene !== false ? state.referenceUpload?.sceneId : null;
  const status = (message, error = false) => { feedback.textContent = message; feedback.dataset.error = String(error); };
  function render() {
    list.replaceChildren();
    for (const scene of scenes) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'custom-scene-choice'; button.dataset.customScene = scene.id;
      button.disabled = !!state.busy || !!state.customSceneApplying;
      const selected = selectedId() === scene.id;
      button.setAttribute('aria-pressed', String(selected)); button.setAttribute('aria-label', '使用场景：' + scene.name);
      const image = document.createElement('img'); image.src = scene.imageUrl; image.alt = ''; image.loading = 'lazy';
      const title = document.createElement('span'); title.textContent = scene.name;
      const mark = document.createElement('b'); mark.textContent = selected ? '✓' : '使用';
      button.append(image, title, mark); button.onclick = () => void apply(scene); list.append(button);
    }
    if (!scenes.length) { const empty = document.createElement('p'); empty.className = 'custom-scene-empty'; empty.textContent = loading ? '正在读取场景…' : '还没有保存的场景，先创建一个喜欢的房间。'; list.append(empty); }
    section.querySelector('#removeCustomScene').hidden = !selectedId();
    section.querySelector('#removeCustomScene').disabled = !!state.busy || !!state.customSceneApplying;
    section.querySelector('#refreshCustomScenes').disabled = loading || !!state.customSceneApplying;
  }
  async function requestScenes() {
    if (loading) return;
    loading = true; render();
    try {
      const response = await fetch('/api/scenes', {signal:AbortSignal.timeout(15000)});
      const value = await response.json(); if (!response.ok) throw Error(value.error || '场景库暂时无法读取');
      scenes = (Array.isArray(value.scenes) ? value.scenes : []).filter(scene => uuid.test(scene.id) && typeof scene.name === 'string' && scene.imageUrl === '/api/scenes/' + scene.id + '/image');
      loadedAt = Date.now();
      status(selectedId() ? '当前已选用：' + (state.referenceUpload?.sceneName || '我的场景') : scenes.length ? '点击场景后，即可使用当前花型开始拍摄。' : '');
    } catch (error) { status(error.name === 'TimeoutError' ? '读取场景超时，可点击刷新重试。' : error.message, true); }
    finally { loading = false; render(); }
  }
  async function prepare(scene) {
    const response = await fetch(scene.imageUrl, {signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw Error(response.status === 404 ? '这个场景已被移除，请刷新场景库。' : '场景图片暂时无法读取，请稍后再试。');
    const blob = await response.blob(); if (blob.type !== 'image/png' || blob.size > 30 * 1024 * 1024) throw Error('场景图片格式或大小无效');
    const temporary = URL.createObjectURL(blob), image = new Image();
    try {
      image.src = temporary; await image.decode();
      if (image.naturalWidth > 16000 || image.naturalHeight > 16000 || image.naturalWidth * image.naturalHeight > 64e6) throw Error('场景图片过大，请重新创建');
      const scale = Math.min(1, 1536 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale)); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const normalized = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!normalized || normalized.size > 10 * 1024 * 1024) throw Error('场景参考图过大，请重新创建');
      const file = new File([normalized], scene.name + '.png', {type:'image/png'});
      return {file, url:URL.createObjectURL(file), pattern:canvas, sceneId:scene.id, sceneName:scene.name};
    } finally { URL.revokeObjectURL(temporary); }
  }
  async function apply(scene) {
    if (state.busy || state.customSceneApplying) return status('请等待当前处理完成后再切换场景。', true);
    const revision = ++referenceUploadRevision;
    state.customSceneApplying = true; updateCount(); render(); status('正在应用：' + scene.name + '…');
    let prepared;
    try {
      prepared = await prepare(scene);
      if (revision !== referenceUploadRevision || state.busy) { URL.revokeObjectURL(prepared.url); status('设置已更新，本次场景应用已取消。'); return; }
      const previous = shootingReferenceItems();
      state.referenceUploads = [prepared]; state.referenceUpload = prepared; state.referencePattern = prepared.pattern;
      state.referenceScene = true; state.referenceAngle = false; state.recommendScene = false; state.generateSet = false;
      previous.forEach(item => URL.revokeObjectURL(item.url));
      document.getElementById('shootingReferenceFile').value = '';
      renderReferenceControl(); renderSelections();
      status('已选用「' + scene.name + '」。只参考场景，花型、工艺和拍摄角度仍按当前设置。');
      toast('已应用场景：' + scene.name);
      const locationURL = new URL(location.href);
      if (locationURL.searchParams.get('scene') === scene.id) { locationURL.searchParams.delete('scene'); history.replaceState(history.state, '', locationURL.pathname + locationURL.search + locationURL.hash); }
    } catch (error) { status(error.name === 'TimeoutError' ? '应用场景超时，原设置保留，请稍后再试。' : error.message, true); }
    finally { state.customSceneApplying = false; updateCount(); render(); }
  }
  section.querySelector('#refreshCustomScenes').onclick = () => void requestScenes();
  section.querySelector('#removeCustomScene').onclick = () => {
    if (state.busy || state.customSceneApplying) return;
    if (selectedId()) clearShootingReference(false);
    renderSelections(); render(); status('已取消使用，按已选的内置场景拍摄。');
  };
  for (const id of ['referenceUploadInfo', 'generateBtn', 'referenceScene']) {
    const target = document.getElementById(id);
    if (target) new MutationObserver(render).observe(target, {attributes:true, attributeFilter:['hidden','disabled']});
  }
  document.getElementById('referenceScene')?.addEventListener('change', render);
  window.addEventListener('focus', () => { if (Date.now() - loadedAt > 5000) void requestScenes(); });
  window.addEventListener('storage', event => { if (event.key === 'zhijing-scenes-updated-v1') void requestScenes(); });
  const entryReferenceRevision = referenceUploadRevision;
  let entryChanged = false;
  function manualSceneChoice() {
    entryChanged = true;
    if (state.customSceneApplying) referenceUploadRevision++;
  }
  document.addEventListener('click', event => {
    const control = event.target.closest('[data-scene], #selectAllScenes, #applyLastShooting');
    if (control && !control.disabled && !state.busy) manualSceneChoice();
  }, true);
  for (const id of ['referenceScene', 'referenceAngle']) {
    document.getElementById(id)?.addEventListener('change', manualSceneChoice, true);
  }
  void requestScenes().then(() => {
    const requested = new URL(location.href).searchParams.get('scene'); if (!requested) return;
    const scene = scenes.find(scene => scene.id === requested);
    if (entryChanged || referenceUploadRevision !== entryReferenceRevision || state.referenceUpload || state.busy) { status('拍摄设置已更新，请在“我的场景”中点击选用。'); return; }
    if (scene) void apply(scene); else status('未找到该场景，可能已移除。请在“我的场景”中重新选择。', true);
  });
})();
