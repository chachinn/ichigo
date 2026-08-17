(() => {
  'use strict';

  const DATA_KEY = 'ichigo-v1-data';
  let queued = false;

  const norm = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

  function readData() {
    try {
      const db = JSON.parse(localStorage.getItem(DATA_KEY) || '{}');
      return db && Array.isArray(db.products) ? db : null;
    } catch (_) { return null; }
  }

  function writeData(db) {
    localStorage.setItem(DATA_KEY, JSON.stringify(db));
  }

  function findOpenProduct() {
    const sheet = document.getElementById('sheetContent');
    if (!sheet || !sheet.querySelector('#editProduct')) return null;
    const title = sheet.querySelector('.sheet-title h2')?.textContent?.trim() || '';
    if (!title) return null;
    const db = readData();
    if (!db) return null;
    const exact = db.products.find(item => norm(item.name) === norm(title));
    if (exact) return { db, product: exact };
    const matches = db.products.filter(item => norm(title).includes(norm(item.name)) || norm(item.name).includes(norm(title)));
    return matches.length === 1 ? { db, product: matches[0] } : null;
  }

  function decorate() {
    const panel = document.getElementById('ichigoWebMatchPanel');
    if (!panel || panel.querySelector('#ichigoVerifiedDescription')) return;
    const found = findOpenProduct();
    if (!found) return;
    const { product } = found;
    const saveButton = panel.querySelector('#ichigoSaveVerifiedUrl');
    if (!saveButton) return;

    const fields = document.createElement('div');
    fields.innerHTML = `
      <div class="field" style="margin-top:12px">
        <label>Product image URL</label>
        <input id="ichigoVerifiedImageUrl" type="url" inputmode="url" placeholder="https://.../product-image.jpg" value="${String(product.webImage || product.onlineImage || product.image || '').replace(/"/g,'&quot;')}">
      </div>
      <div class="field">
        <label>Product description</label>
        <textarea id="ichigoVerifiedDescription" placeholder="Paste or write a short verified description of this exact product.">${String(product.webDescription || product.onlineGenericName || '').replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]))}</textarea>
      </div>`;
    saveButton.closest('.button-row')?.insertAdjacentElement('beforebegin', fields);

    saveButton.addEventListener('click', () => {
      setTimeout(() => {
        const fresh = findOpenProduct();
        if (!fresh) return;
        const image = document.getElementById('ichigoVerifiedImageUrl')?.value.trim() || '';
        const description = document.getElementById('ichigoVerifiedDescription')?.value.trim() || '';
        if (image) fresh.product.webImage = image;
        if (description) fresh.product.webDescription = description;
        fresh.product.updatedAt = Date.now();
        writeData(fresh.db);
      }, 0);
    }, true);
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
