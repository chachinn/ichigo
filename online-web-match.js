(() => {
  'use strict';

  const DATA_KEY = 'ichigo-v1-data';
  let decorateQueued = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[ch]));
  const norm = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

  function readData() {
    try {
      const db = JSON.parse(localStorage.getItem(DATA_KEY) || '{}');
      return db && Array.isArray(db.products) ? db : null;
    } catch (_) {
      return null;
    }
  }

  function writeData(db) {
    localStorage.setItem(DATA_KEY, JSON.stringify(db));
  }

  function googleSearch(query) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(query);
  }

  function googleImages(query) {
    return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query);
  }

  function siteSearch(domain, query) {
    return googleSearch(`site:${domain} "${query}"`);
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
    const candidates = db.products.filter(item => norm(title).includes(norm(item.name)) || norm(item.name).includes(norm(title)));
    return candidates.length === 1 ? { db, product: candidates[0] } : null;
  }

  function isSearchReference(url = '') {
    try {
      const parsed = new URL(url);
      return /(^|\.)google\./i.test(parsed.hostname) && parsed.pathname.includes('/search');
    } catch (_) {
      return false;
    }
  }

  function isHttpUrl(url = '') {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch (_) {
      return false;
    }
  }

  function sourceProfile(product) {
    const text = norm([product.category, product.name, product.brand, ...(product.tags || [])].filter(Boolean).join(' '));
    const perfume = /\b(perfume|parfum|fragrance|cologne|eau de|edp|edt|eau parfum|eau toilette)\b/.test(text);
    const makeup = /\b(primer|foundation|skin tint|bb|cc|concealer|powder|blush|highlighter|bronzer|contour|setting spray|eyeshadow|eyeliner|mascara|brows|lipstick|lip tint|lip gloss|lip liner|makeup palette|false lashes)\b/.test(text);
    const hair = /\b(hair|scalp|shampoo|conditioner|treatment|hair oil|hair milk)\b/.test(text);
    const skincare = !perfume && !makeup && !hair;
    return { perfume, makeup, hair, skincare };
  }

  function sourceButtons(product, query) {
    const profile = sourceProfile(product);
    const buttons = [];
    if (profile.perfume) {
      buttons.push(['Fragrantica', siteSearch('fragrantica.com', query)]);
      buttons.push(['Sephora', siteSearch('sephora.com', query)]);
    } else if (profile.makeup) {
      buttons.push(['YesStyle', siteSearch('yesstyle.com', query)]);
      buttons.push(['Sephora', siteSearch('sephora.com', query)]);
      buttons.push(['Olive Young', siteSearch('global.oliveyoung.com', query)]);
    } else if (profile.hair) {
      buttons.push(['YesStyle', siteSearch('yesstyle.com', query)]);
      buttons.push(['Olive Young', siteSearch('global.oliveyoung.com', query)]);
    } else if (profile.skincare) {
      buttons.push(['YesStyle', siteSearch('yesstyle.com', query)]);
      buttons.push(['Olive Young', siteSearch('global.oliveyoung.com', query)]);
      buttons.push(['Sephora', siteSearch('sephora.com', query)]);
    }
    return buttons;
  }

  function decorateProductDetail() {
    const sheet = document.getElementById('sheetContent');
    if (!sheet || sheet.querySelector('#ichigoWebMatchPanel')) return;
    const found = findOpenProduct();
    if (!found) return;
    const { product } = found;
    const actions = sheet.querySelector('#editProduct')?.closest('.button-row');
    if (!actions) return;

    const query = [product.brand, product.name].filter(Boolean).join(' ').trim() || product.name;
    const quoted = `"${query}"`;
    const officialQuery = `${quoted} official ${product.brand || ''}`.trim();
    const barcodeQuery = product.barcode ? `"${product.barcode}" ${quoted}` : '';
    const savedUrl = product.sourceUrl || '';
    const savedExact = savedUrl && !isSearchReference(savedUrl);
    const sources = sourceButtons(product, query);

    const panel = document.createElement('section');
    panel.id = 'ichigoWebMatchPanel';
    panel.className = 'section';
    panel.innerHTML = `
      <div class="section-head"><div><h2>Find this product online</h2><p>Search high-coverage beauty sources, then save the exact page you verify.</p></div></div>
      <div class="card">
        <div class="badges" style="margin-bottom:10px">
          <span class="badge ${savedExact ? 'green' : 'gray'}">${savedExact ? 'Exact page saved' : savedUrl ? 'Search reference only' : 'No web page saved'}</span>
          ${product.onlineMatchStatus === 'structured' ? '<span class="badge lav">Structured match</span>' : ''}
        </div>
        ${sources.length ? `<div style="margin:4px 0 12px"><strong style="font-size:12px">Best places to check</strong><div class="button-row" style="margin-top:8px">${sources.map(([label,url],i)=>`<button class="secondary" data-ichigo-source="${i}" type="button">${esc(label)}</button>`).join('')}</div></div>` : ''}
        <div class="button-row">
          <button class="secondary" id="ichigoExactWebSearch" type="button">Search exact product</button>
          <button class="secondary" id="ichigoOfficialSearch" type="button">Find official brand page</button>
          <button class="secondary" id="ichigoImageSearch" type="button">Check product images</button>
          ${barcodeQuery ? '<button class="secondary" id="ichigoBarcodeSearch" type="button">Search barcode</button>' : ''}
        </div>
        <div class="field" style="margin-top:14px">
          <label>Verified product page URL</label>
          <input id="ichigoVerifiedProductUrl" type="url" inputmode="url" placeholder="https://brand.com/product/..." value="${savedExact ? esc(savedUrl) : ''}">
        </div>
        <div class="button-row">
          <button class="primary" id="ichigoSaveVerifiedUrl" type="button">Save verified page</button>
          ${savedExact ? '<button class="secondary" id="ichigoOpenSavedUrl" type="button">Open saved page</button>' : ''}
        </div>
        <div id="ichigoWebMatchMessage" class="info-box hidden" style="margin-top:10px"></div>
        <p style="margin-top:10px">Ichigo does not scrape retailer or fragrance sites or silently copy their data. Open the source, confirm the exact item, then save that product page here.</p>
      </div>`;
    actions.insertAdjacentElement('afterend', panel);

    document.querySelectorAll('[data-ichigo-source]').forEach(button => button.addEventListener('click', () => {
      const source = sources[Number(button.dataset.ichigoSource)];
      if (source) window.open(source[1], '_blank', 'noopener');
    }));
    document.getElementById('ichigoExactWebSearch')?.addEventListener('click', () => window.open(googleSearch(quoted + ' skincare beauty makeup fragrance'), '_blank', 'noopener'));
    document.getElementById('ichigoOfficialSearch')?.addEventListener('click', () => window.open(googleSearch(officialQuery), '_blank', 'noopener'));
    document.getElementById('ichigoImageSearch')?.addEventListener('click', () => window.open(googleImages(quoted), '_blank', 'noopener'));
    document.getElementById('ichigoBarcodeSearch')?.addEventListener('click', () => window.open(googleSearch(barcodeQuery), '_blank', 'noopener'));
    document.getElementById('ichigoOpenSavedUrl')?.addEventListener('click', () => window.open(savedUrl, '_blank', 'noopener'));
    document.getElementById('ichigoSaveVerifiedUrl')?.addEventListener('click', () => saveVerifiedUrl(product.id));
  }

  function showMessage(message, good = false) {
    const box = document.getElementById('ichigoWebMatchMessage');
    if (!box) return;
    box.textContent = message;
    box.classList.remove('hidden');
    box.style.background = good ? '#edf6f0' : '';
    box.style.borderColor = good ? '#cfe5d6' : '';
    box.style.color = good ? '#3d684d' : '';
  }

  function saveVerifiedUrl(productId) {
    const input = document.getElementById('ichigoVerifiedProductUrl');
    const url = input?.value.trim() || '';
    if (!isHttpUrl(url)) return showMessage('Paste a full http:// or https:// product page URL first.');
    if (isSearchReference(url)) return showMessage('That is still a Google search page. Open the exact product result first, then paste the product page URL.');
    const db = readData();
    const product = db?.products.find(item => String(item.id) === String(productId));
    if (!db || !product) return showMessage('Ichigo could not find this saved product. Nothing was changed.');
    product.sourceUrl = url;
    product.sourceName = 'Verified Web Page';
    product.onlineMatchStatus = 'verified-web';
    product.onlineLinkedAt = Date.now();
    product.updatedAt = Date.now();
    writeData(db);
    showMessage('Verified product page saved. Your personal product data was not changed.', true);
  }

  const sheet = document.getElementById('sheetContent');
  if (sheet) {
    const observer = new MutationObserver(() => {
      if (decorateQueued) return;
      decorateQueued = true;
      queueMicrotask(() => {
        decorateQueued = false;
        decorateProductDetail();
      });
    });
    observer.observe(sheet, { childList: true, subtree: true });
  }

  decorateProductDetail();
})();
