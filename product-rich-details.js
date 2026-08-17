(() => {
  'use strict';

  const DATA_KEY = 'ichigo-v1-data';
  let queued = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const norm = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

  function readData() {
    try {
      const db = JSON.parse(localStorage.getItem(DATA_KEY) || '{}');
      return db && Array.isArray(db.products) ? db : null;
    } catch (_) { return null; }
  }

  function findOpenProduct() {
    const sheet = document.getElementById('sheetContent');
    if (!sheet || !sheet.querySelector('#editProduct')) return null;
    const title = sheet.querySelector('.sheet-title h2')?.textContent?.trim() || '';
    if (!title) return null;
    const db = readData();
    if (!db) return null;
    const exact = db.products.find(item => norm(item.name) === norm(title));
    if (exact) return exact;
    const candidates = db.products.filter(item => norm(title).includes(norm(item.name)) || norm(item.name).includes(norm(title)));
    return candidates.length === 1 ? candidates[0] : null;
  }

  function inferredDescription(product) {
    if (product.webDescription) return product.webDescription;
    if (product.onlineGenericName) return product.onlineGenericName;
    if (product.onlineCategories) {
      const first = String(product.onlineCategories).split(',').map(x => x.trim()).filter(Boolean).slice(0, 3);
      if (first.length) return `Online category: ${first.join(' · ')}`;
    }
    return '';
  }

  function decorate() {
    const sheet = document.getElementById('sheetContent');
    if (!sheet || sheet.querySelector('#ichigoRichProductCard')) return;
    const product = findOpenProduct();
    if (!product) return;

    const image = product.webImage || product.image || product.onlineImage || '';
    const description = inferredDescription(product);
    if (!image && !description) return;

    const anchor = sheet.querySelector('.sheet-title');
    if (!anchor) return;

    const card = document.createElement('section');
    card.id = 'ichigoRichProductCard';
    card.className = 'card';
    card.style.marginBottom = '14px';
    card.innerHTML = `
      <div style="display:grid;grid-template-columns:${image ? '92px 1fr' : '1fr'};gap:14px;align-items:start">
        ${image ? `<div style="width:92px;height:92px;border-radius:20px;overflow:hidden;border:1px solid var(--line);background:#fff7f4"><img src="${esc(image)}" alt="${esc(product.name || 'Product')}" style="width:100%;height:100%;object-fit:cover" onerror="this.closest('div').style.display='none'"></div>` : ''}
        <div>
          <span class="eyebrow">PRODUCT INFO</span>
          <h3 style="margin:5px 0 6px">About this product</h3>
          <p style="font-size:12px;line-height:1.55">${description ? esc(description) : 'No product description saved yet.'}</p>
          ${product.sourceName ? `<div class="badges" style="margin-top:9px"><span class="badge gray">${esc(product.sourceName)}</span></div>` : ''}
        </div>
      </div>`;
    anchor.insertAdjacentElement('afterend', card);
  }

  const sheet = document.getElementById('sheetContent');
  if (sheet) {
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; decorate(); });
    });
    observer.observe(sheet, { childList:true, subtree:true });
  }

  decorate();
})();
