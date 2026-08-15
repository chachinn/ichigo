(() => {
  'use strict';

  const DATA_KEY = 'ichigo-v1-data';
  const REPAIR_DELAY = 850;
  let lastProductId = '';
  let sheetQueued = false;
  let mainQueued = false;
  let backgroundRunning = false;
  const inFlight = new Map();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));

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

  function isStructured(product) {
    return product && (product.onlineMatchStatus === 'structured' || product.sourceName === 'Open Beauty Facts');
  }

  function barcodeFor(product) {
    const direct = String(product?.barcode || '').trim();
    if (direct) return direct;
    const match = String(product?.sourceUrl || '').match(/\/product\/([^/?#]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  }

  function stringsDeep(value, out = []) {
    if (!value) return out;
    if (typeof value === 'string') {
      if (/^https:\/\//i.test(value)) out.push(value);
      return out;
    }
    if (Array.isArray(value)) {
      value.forEach(item => stringsDeep(item, out));
      return out;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(item => stringsDeep(item, out));
    }
    return out;
  }

  function chooseImage(remote) {
    const selected = remote?.selected_images?.front || null;
    const selectedUrls = stringsDeep(selected);
    const candidates = [
      ...selectedUrls,
      remote?.image_front_url,
      remote?.image_url,
      remote?.image_front_small_url,
      remote?.image_small_url,
      remote?.image_thumb_url
    ].filter(Boolean);
    return [...new Set(candidates)].find(url => /^https:\/\//i.test(url)) || '';
  }

  async function fetchPhotoRecord(product) {
    const code = barcodeFor(product);
    if (!code || !navigator.onLine) return null;
    if (inFlight.has(code)) return inFlight.get(code);

    const promise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      try {
        const fields = [
          'code','product_name','brands','quantity','selected_images',
          'image_front_url','image_front_small_url','image_url','image_small_url','image_thumb_url'
        ].join(',');
        const url = 'https://world.openbeautyfacts.org/api/v2/product/' + encodeURIComponent(code) + '.json?fields=' + encodeURIComponent(fields);
        const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) return null;
        const json = await response.json();
        const remote = json?.product || null;
        if (!remote) return null;
        const image = chooseImage(remote);
        if (!image) return null;
        return { image, remote };
      } catch (_) {
        return null;
      } finally {
        clearTimeout(timeout);
        inFlight.delete(code);
      }
    })();

    inFlight.set(code, promise);
    return promise;
  }

  function savePhoto(productId, result) {
    if (!result?.image) return false;
    const db = readData();
    const stored = db?.products.find(item => String(item.id) === String(productId));
    if (!db || !stored) return false;
    stored.onlineImage = result.image;
    stored.image = result.image;
    if (!stored.onlineProductName && result.remote?.product_name) stored.onlineProductName = result.remote.product_name;
    if (!stored.onlineBrand && result.remote?.brands) stored.onlineBrand = result.remote.brands;
    if (!stored.onlineQuantity && result.remote?.quantity) stored.onlineQuantity = result.remote.quantity;
    stored.onlinePhotoStatus = 'loaded';
    stored.onlinePhotoCheckedAt = Date.now();
    stored.updatedAt = Date.now();
    writeData(db);
    return true;
  }

  function photoUrl(product) {
    return String(product?.onlineImage || product?.image || '').trim();
  }

  function imgMarkup(product, url, size = 104) {
    return `<div class="product-thumb ichigo-web-photo" style="width:${size}px;height:${size}px;flex:0 0 ${size}px"><img src="${esc(url)}" alt="${esc(product.name || 'Product')} product photo" referrerpolicy="no-referrer" decoding="async"></div>`;
  }

  function bindImageFallback(img, product) {
    if (!img || img.dataset.photoFallbackBound === '1') return;
    img.dataset.photoFallbackBound = '1';
    img.addEventListener('error', async () => {
      const result = await fetchPhotoRecord(product);
      if (result?.image && result.image !== img.src) {
        savePhoto(product.id, result);
        img.src = result.image;
        return;
      }
      const wrap = img.closest('.product-thumb');
      if (wrap) wrap.innerHTML = '<span aria-hidden="true">🧴</span>';
    }, { once: true });
  }

  function syncStashPhotos() {
    const db = readData();
    if (!db) return;
    const byId = new Map(db.products.map(item => [String(item.id), item]));
    document.querySelectorAll('[data-product]').forEach(card => {
      const product = byId.get(String(card.dataset.product));
      if (!product || !isStructured(product)) return;
      const url = photoUrl(product);
      const thumb = card.querySelector('.product-thumb');
      if (!thumb) return;
      let img = thumb.querySelector('img');
      if (url) {
        if (!img) {
          thumb.innerHTML = `<img src="${esc(url)}" alt="${esc(product.name || 'Product')}" referrerpolicy="no-referrer" loading="lazy" decoding="async">`;
          img = thumb.querySelector('img');
        } else if (img.getAttribute('src') !== url) {
          img.src = url;
        }
        bindImageFallback(img, product);
      }
    });
  }

  function currentProduct() {
    const db = readData();
    if (!db) return null;
    if (lastProductId) {
      const direct = db.products.find(item => String(item.id) === String(lastProductId));
      if (direct) return direct;
    }
    const title = document.querySelector('#sheetContent .sheet-title h2')?.textContent?.trim();
    if (!title) return null;
    return db.products.find(item => item.name === title || item.onlineProductName === title) || null;
  }

  async function syncOpenProductPhoto() {
    const product = currentProduct();
    if (!product || !isStructured(product)) return;
    let url = photoUrl(product);
    if (!url) {
      const result = await fetchPhotoRecord(product);
      if (result?.image) {
        savePhoto(product.id, result);
        url = result.image;
      }
    }
    if (!url) return;

    const sheet = document.getElementById('sheetContent');
    if (!sheet) return;

    const existingImgs = [...sheet.querySelectorAll('img')];
    let img = existingImgs.find(node => /product photo/i.test(node.alt || '') || node.closest('#ichigoProductGuide')) || existingImgs[0];
    if (img) {
      if (img.getAttribute('src') !== url) img.src = url;
      img.referrerPolicy = 'no-referrer';
      bindImageFallback(img, product);
    } else {
      const guideCard = document.querySelector('#ichigoProductGuide .card');
      const sheetTitle = sheet.querySelector('.sheet-title');
      const photo = document.createElement('div');
      photo.style.cssText = 'display:flex;gap:14px;align-items:center;margin:0 0 16px';
      photo.innerHTML = `${imgMarkup(product, url, 110)}<div style="min-width:0;flex:1"><span class="eyebrow">CONFIRMED WEB PHOTO</span><strong style="display:block;margin-top:5px">${esc(product.onlineProductName || product.name || '')}</strong></div>`;
      if (guideCard) guideCard.prepend(photo);
      else sheetTitle?.insertAdjacentElement('afterend', photo);
      img = photo.querySelector('img');
      bindImageFallback(img, product);
    }
    syncStashPhotos();
  }

  async function repairMissingPhotosInBackground() {
    if (backgroundRunning || !navigator.onLine) return;
    const db = readData();
    if (!db) return;
    const queue = db.products.filter(product => isStructured(product) && !photoUrl(product) && barcodeFor(product));
    if (!queue.length) return;
    backgroundRunning = true;
    try {
      for (const product of queue) {
        if (!navigator.onLine) break;
        const result = await fetchPhotoRecord(product);
        if (result?.image) savePhoto(product.id, result);
        syncStashPhotos();
        await new Promise(resolve => setTimeout(resolve, REPAIR_DELAY));
      }
    } finally {
      backgroundRunning = false;
      syncStashPhotos();
    }
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-product-menu],[data-product]');
    if (target) {
      lastProductId = target.dataset.productMenu || target.dataset.product || '';
      setTimeout(syncOpenProductPhoto, 80);
    }
  }, true);

  const sheet = document.getElementById('sheetContent');
  if (sheet) {
    new MutationObserver(() => {
      if (sheetQueued) return;
      sheetQueued = true;
      requestAnimationFrame(() => {
        sheetQueued = false;
        syncOpenProductPhoto();
      });
    }).observe(sheet, { childList: true, subtree: true });
  }

  const main = document.getElementById('main');
  if (main) {
    new MutationObserver(() => {
      if (mainQueued) return;
      mainQueued = true;
      requestAnimationFrame(() => {
        mainQueued = false;
        syncStashPhotos();
      });
    }).observe(main, { childList: true, subtree: true });
  }

  window.addEventListener('online', () => {
    syncOpenProductPhoto();
    repairMissingPhotosInBackground();
  });
  window.addEventListener('pageshow', () => {
    syncStashPhotos();
    syncOpenProductPhoto();
    repairMissingPhotosInBackground();
  });

  syncStashPhotos();
  syncOpenProductPhoto();
  setTimeout(repairMissingPhotosInBackground, 500);
})();
