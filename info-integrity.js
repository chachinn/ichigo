(() => {
  'use strict';

  const DATA_KEY = 'ichigo-v1-data';
  let lastProductId = '';
  let runToken = 0;

  const norm = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'
  }[ch]));

  function readData() {
    try {
      const db = JSON.parse(localStorage.getItem(DATA_KEY) || '{}');
      return db && Array.isArray(db.products) ? db : null;
    } catch (_) {
      return null;
    }
  }

  function currentProduct() {
    const db = readData();
    if (!db) return null;
    if (lastProductId) {
      const direct = db.products.find(product => String(product.id) === String(lastProductId));
      if (direct) return direct;
    }
    const title = document.querySelector('#sheetContent .sheet-title h2')?.textContent?.trim();
    if (!title) return null;
    return db.products.find(product => norm(product.name) === norm(title)) || null;
  }

  function findLabelBlock(root, label) {
    const heading = [...root.querySelectorAll('strong')].find(el => el.textContent.trim() === label);
    return heading?.parentElement || null;
  }

  function fallbackSummary(product) {
    const name = product.onlineProductName || product.name || 'This product';
    const brand = product.onlineBrand || product.brand || '';
    const label = brand && !norm(name).startsWith(norm(brand)) ? `${brand} ${name}` : name;
    const category = product.category || 'beauty product';
    const tags = Array.isArray(product.tags) ? product.tags.filter(Boolean) : [];
    const activeText = tags.length ? ` Its saved product data identifies ${tags.slice(0, 3).join(', ')} as key ingredient or active tags.` : '';
    return `${label} is a ${category.toLowerCase()} in your Ichigo collection.${activeText} The exact claims, strength and intended use should follow the matched product record or packaging when those details are available.`;
  }

  function fallbackUse(product) {
    const category = String(product.category || '');
    const text = norm([product.name, product.onlineProductName, product.tags?.join(' ')].filter(Boolean).join(' '));
    if (/tretinoin/.test(text)) return 'Use exactly as prescribed. Apply only as directed by your prescriber to clean, fully dry skin, avoid the eyes, lips, corners of the nose and broken skin, and use daytime sun protection.';
    if (category === 'Sunscreen') return 'Apply generously and evenly as the final morning skincare step before sun exposure. Reapply according to the sunscreen label, including after swimming or sweating when applicable.';
    if (category === 'First Cleanse') return 'Use as the first cleansing step to remove sunscreen, makeup and oil-based residue, then rinse or remove it exactly as the package directs. Follow with a water-based cleanser if desired or directed.';
    if (category === 'Cleanser') return 'Use during cleansing, massage gently without scrubbing, rinse thoroughly if it is a rinse-off formula, and follow any product-specific contact-time or frequency directions on the label.';
    if (category === 'Wash-Off Mask') return 'Apply after cleansing, avoid the eye and lip areas, leave it on only for the time stated on the package, then rinse thoroughly and continue with leave-on skincare.';
    if (category === 'Sheet Mask') return 'Apply to clean skin, leave it on for the package-specified time, remove it, and follow the remaining essence and moisturizer directions on the label.';
    if (['Toner','Essence','Serum','Ampoule'].includes(category)) return 'Apply as a leave-on step after cleansing, generally from lighter to richer textures, then follow with moisturizer. Use the amount and frequency stated on the package, especially when treatment actives are present.';
    if (category === 'Moisturizer') return 'Apply after lighter leave-on products to hydrate and help reduce moisture loss. In the morning, follow with sunscreen.';
    if (category === 'Eye Care') return 'Use a small amount around the eye area as directed, applying gently and keeping the product out of the eyes unless the packaging specifically states otherwise.';
    if (['Prescription / Dermatologist Treatment','Acne Treatment','Spot Treatment'].includes(category)) return 'Follow the medication, product label or prescriber directions for amount, placement, timing and frequency. Do not substitute a generic routine order for prescription instructions.';
    return 'Follow the product packaging for the exact amount, placement, timing and frequency. Ichigo only supplies general routine guidance when official product-specific directions are not available.';
  }

  function ensureGuideContent(product) {
    const guide = document.getElementById('ichigoProductGuide');
    if (!guide) return false;
    guide.dataset.productId = String(product.id || '');

    const whatBlock = findLabelBlock(guide, 'What it is');
    const whatText = whatBlock?.querySelector('p');
    if (whatText) {
      const current = whatText.textContent.trim();
      const generic = !current || /its exact purpose depends|not just a generic|in your ichigo stash/i.test(current);
      if (generic) whatText.textContent = fallbackSummary(product);
    }

    if (!guide.querySelector('[data-ichigo-how-to-use]')) {
      const anchor = whatBlock || guide.querySelector('.card');
      if (anchor) {
        const block = document.createElement('div');
        block.dataset.ichigoHowToUse = '1';
        block.style.marginTop = '16px';
        block.innerHTML = `<strong>How to use</strong><p style="margin-top:5px"></p><small style="display:block;margin-top:6px;opacity:.72">General guidance — product packaging or prescriber directions take priority.</small>`;
        block.querySelector('p').textContent = fallbackUse(product);
        if (whatBlock) whatBlock.insertAdjacentElement('afterend', block);
        else anchor.appendChild(block);
      }
    }

    const expected = [
      ['Brand', product.onlineBrand || product.brand || 'Not confirmed yet'],
      ['Product type', product.category || 'Other']
    ];
    const boxes = [...guide.querySelectorAll('.info-box')];
    expected.forEach(([label, value]) => {
      const box = boxes.find(item => item.querySelector('small')?.textContent.trim() === label);
      const strong = box?.querySelector('strong');
      if (strong && !strong.textContent.trim()) strong.textContent = value;
    });

    const structured = product.onlineMatchStatus === 'structured' || product.sourceName === 'Open Beauty Facts';
    const imageUrl = structured ? (product.onlineImage || product.image || '') : (product.image || '');
    if (imageUrl && structured && !guide.querySelector('img')) {
      const card = guide.querySelector('.card');
      if (card) {
        const photo = document.createElement('div');
        photo.style.cssText = 'display:flex;gap:14px;align-items:center;margin-bottom:16px';
        photo.innerHTML = `<div class="product-thumb" style="width:104px;height:104px;flex:0 0 104px"><img src="${esc(imageUrl)}" alt="${esc(product.name || 'Product')} product photo"></div><div style="min-width:0;flex:1"><span class="eyebrow">WEB PRODUCT PHOTO</span><strong style="display:block;margin-top:5px">${esc(product.onlineProductName || product.name || '')}</strong></div>`;
        card.prepend(photo);
      }
    }

    const img = guide.querySelector('img');
    if (img && !img.dataset.integrityBound) {
      img.dataset.integrityBound = '1';
      img.addEventListener('error', () => {
        const wrap = img.closest('.product-thumb');
        if (wrap) wrap.innerHTML = '<span aria-hidden="true">🧴</span>';
      }, { once: true });
    }

    const sheet = document.getElementById('sheetContent');
    if (sheet && product.ingredients && ![...sheet.querySelectorAll('.section-head h2')].some(h => h.textContent.trim() === 'Ingredients')) {
      const actionRow = sheet.querySelector('#editProduct')?.closest('.button-row');
      if (actionRow) actionRow.insertAdjacentHTML('beforebegin', `<section class="section"><div class="section-head"><h2>Ingredients</h2></div><div class="card"><p>${esc(product.ingredients)}</p></div></section>`);
    }

    return true;
  }

  function runIntegrityPasses() {
    const token = ++runToken;
    const delays = [0, 50, 160, 420, 900];
    delays.forEach(delay => setTimeout(() => {
      if (token !== runToken) return;
      const product = currentProduct();
      if (!product) return;
      ensureGuideContent(product);
    }, delay));
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-product-menu],[data-product]');
    if (target) {
      lastProductId = target.dataset.productMenu || target.dataset.product || '';
      runIntegrityPasses();
    }
  }, true);

  const sheet = document.getElementById('sheetContent');
  if (sheet) {
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const product = currentProduct();
        if (product) ensureGuideContent(product);
      });
    }).observe(sheet, { childList: true, subtree: true });
  }

  window.addEventListener('pageshow', runIntegrityPasses);
  runIntegrityPasses();
})();
