export function installDetailHistoryPicker({getQueue, isBusy, addGroup}) {
  const trigger = document.getElementById('detailPickHistory');
  const dialog = document.createElement('dialog');
  dialog.className = 'detail-history-picker';
  dialog.setAttribute('aria-labelledby', 'detailHistoryPickerTitle');
  dialog.innerHTML = '<header><h2 id="detailHistoryPickerTitle">从图片记录挑选</h2><button type="button" class="picker-close" aria-label="关闭图片挑选">×</button></header><div class="picker-tools"><span class="picker-total"></span><button type="button" class="outline-button picker-page-all">全选本页</button><button type="button" class="outline-button picker-clear">清空选择</button><span class="picker-selected" role="status"></span></div><div class="picker-content"><p class="picker-message" role="status"></p><button type="button" class="outline-button picker-retry" hidden>重新加载</button><div class="picker-grid"></div></div><footer><div class="picker-pages"><button type="button" class="outline-button picker-prev">上一页</button><span></span><button type="button" class="outline-button picker-next">下一页</button></div><button type="button" class="outline-button picker-cancel">取消</button><button type="button" class="picker-add" disabled>加入详情素材</button></footer>';
  document.body.append(dialog);
  const find = selector => dialog.querySelector(selector);
  let records = [], page = 0, selected = new Set(), loading = false;
  const pageSize = 48;
  const currentPage = () => records.slice(page * pageSize, (page + 1) * pageSize);
  const alreadyAdded = item => getQueue().some(x => x.url === item.url || (x.number && x.number === item.number));
  function updateSelection() {
    find('.picker-selected').textContent = '已选 ' + selected.size + ' 张';
    find('.picker-add').disabled = !selected.size || loading || isBusy();
    find('.picker-page-all').disabled = loading || !currentPage().some(x => !alreadyAdded(x));
    find('.picker-clear').disabled = !selected.size;
    dialog.querySelectorAll('.picker-image').forEach(button => {
      const active = selected.has(Number(button.dataset.number));
      button.setAttribute('aria-pressed', String(active));
      button.querySelector('.picker-check').textContent = active ? '✓' : '';
    });
  }
  function render() {
    const grid = find('.picker-grid');
    grid.replaceChildren();
    const visible = currentPage();
    for (const item of visible) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'picker-image'; button.dataset.number = item.number;
      button.disabled = alreadyAdded(item);
      button.setAttribute('aria-label', (globalThis.splitPhotoVersions(records).current.some(x=>x.number===item.number) ? '最新作品' : '历史版本') + ' #' + item.number + (button.disabled ? '，已加入素材' : '，选择素材'));
      const img = document.createElement('img');
      img.src = item.url; img.alt = item.sceneLabel || item.productLabel || '生成图片'; img.loading = 'lazy';
      const check = document.createElement('span'); check.className = 'picker-check';
      button.append(img, check);
      if (button.disabled) {
        const badge = document.createElement('span'); badge.className = 'picker-added'; badge.textContent = '已加入'; button.append(badge);
      }
      button.onclick = () => {selected.has(item.number) ? selected.delete(item.number) : selected.add(item.number); updateSelection();};
      grid.append(button);
    }
    find('.picker-message').textContent = records.length ? '' : '暂无图片记录，生成图片后可在这里挑选。';
    find('.picker-total').textContent = '图片记录 · ' + records.length + ' 张';
    const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
    find('.picker-pages span').textContent = (page + 1) + ' / ' + totalPages;
    find('.picker-prev').disabled = page === 0;
    find('.picker-next').disabled = page + 1 >= totalPages;
    updateSelection();
    find('.picker-content').scrollTop = 0;
  }
  async function load() {
    loading = true; find('.picker-grid').replaceChildren();
    find('.picker-message').textContent = '正在读取图片记录…'; find('.picker-retry').hidden = true;
    find('.picker-prev').disabled = find('.picker-next').disabled = true; updateSelection();
    try {
      const response = await fetch('/api/history');
      if (!response.ok) throw Error('图片记录读取失败，请重试。');
      const data = await response.json();
      if (!dialog.open) return;
      records = (data.images || []).filter(x => !x.detailPage && !x.deletedAt && x.url).sort((a, b) => b.number - a.number);
      loading = false; render();
    } catch (error) {
      if (dialog.open) {find('.picker-message').textContent = error.message || '无法读取图片记录'; find('.picker-retry').hidden = false;}
    } finally {loading = false; updateSelection();}
  }
  trigger.onclick = () => {
    if (isBusy()) return;
    records = []; page = 0; selected.clear();
    dialog.showModal(); load();
  };
  find('.picker-retry').onclick = load;
  find('.picker-close').onclick = find('.picker-cancel').onclick = () => dialog.close();
  find('.picker-prev').onclick = () => {if (!loading && page > 0) {page--; render();}};
  find('.picker-next').onclick = () => {if (!loading && (page + 1) * pageSize < records.length) {page++; render();}};
  find('.picker-page-all').onclick = () => {for (const item of currentPage()) if (!alreadyAdded(item)) selected.add(item.number); updateSelection();};
  find('.picker-clear').onclick = () => {selected.clear(); updateSelection();};
  find('.picker-add').onclick = () => {
    if (isBusy()) return;
    const items = records.filter(x => selected.has(x.number) && !alreadyAdded(x));
    if (!items.length) return;
    addGroup(items); dialog.close();
  };
}
