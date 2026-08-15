(() => {
  'use strict';

  const DATA_KEY = 'ichigo-v1-data';
  const SETTINGS_KEY = 'ichigo-v1-settings';
  const BULK_BACKUP_KEY = 'ichigo-v1-bulk-link-backup';
  const AUTO_MATCH_THRESHOLD = 0.56;
  const BULK_MATCH_THRESHOLD = 0.62;
  const BULK_SEARCH_DELAY = 6300;
  let bypassAutoLookup = false;
  let bulkRunning = false;
  let bulkStopRequested = false;
  let lastOpenedProductId = '';
  let mainSyncQueued = false;
  let sheetDecorateQueued = false;

  const norm = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
  const tokens = value => new Set(norm(value).split(/\s+/).filter(Boolean));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));
  const webSearchUrl = query => 'https://www.google.com/search?q=' + encodeURIComponent(String(query || '').trim() + ' skincare makeup product');

  function readData() {
    try {
      const value = JSON.parse(localStorage.getItem(DATA_KEY) || '{}');
      return value && Array.isArray(value.products) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function writeData(value) {
    localStorage.setItem(DATA_KEY, JSON.stringify(value));
  }

  function onlineEnabled() {
    try {
      const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return value.onlineSearch !== false;
    } catch (_) {
      return true;
    }
  }

  function similarity(a, b) {
    const A = tokens(a), B = tokens(b);
    if (!A.size || !B.size) return 0;
    let common = 0;
    A.forEach(token => { if (B.has(token)) common += 1; });
    return common / Math.max(A.size, B.size);
  }

  function scoreMatch(name, brand, product) {
    const remoteName = product.product_name || product.generic_name || '';
    const remoteBrand = product.brands || '';
    const localName = norm(name), candidateName = norm(remoteName);
    let score = similarity(name, remoteName) * 0.72;
    if (localName && candidateName && localName === candidateName) score += 0.22;
    else if (localName && candidateName && (localName.includes(candidateName) || candidateName.includes(localName))) score += 0.12;
    if (brand && remoteBrand) score += similarity(brand, remoteBrand) * 0.18;
    return Math.min(1, score);
  }

  const tagRules = [
    ['Tretinoin', /\btretinoin\b/i], ['Retinal', /\bretinal\b/i], ['Retinol', /\bretinol\b/i],
    ['Benzoyl Peroxide', /\bbenzoyl peroxide\b|\bbenzoper\b/i], ['Azelaic Acid', /\bazelaic\b|\bazeloyl\b/i],
    ['Salicylic Acid / BHA', /\bsalicylic\b|\bbha\b/i], ['AHA', /\baha\b|\bglycolic\b|\blactic acid\b|\bmandelic\b/i],
    ['Vitamin C', /\bvitamin c\b|\bascorb/i], ['Niacinamide', /\bniacinamide\b|\bniacin\b/i],
    ['Alpha Arbutin', /\barbutin\b/i], ['PDRN', /\bpdrn\b/i], ['Peptides', /\bpeptide\b/i],
    ['Ceramides', /\bceramide\b/i], ['Beta-Glucan', /\bbeta[- ]?glucan\b/i], ['Tea Tree', /\btea tree\b/i],
    ['Collagen', /\bcollagen\b/i], ['Hyaluronic Acid', /\bhyaluronic\b|\bsodium hyaluronate\b/i],
    ['Centella', /\bcentella\b|\bcica\b/i]
  ];

  function inferTags(text) {
    return tagRules.filter(([, rule]) => rule.test(text || '')).map(([label]) => label);
  }

  function inferCategory(text) {
    const rules = [
      ['Sunscreen', /\bspf\b|\bsunscreen\b|\bsun screen\b|\buv\b/i],
      ['First Cleanse', /\bcleansing oil\b|\bcleansing balm\b|\bmicellar\b/i],
      ['Cleanser', /\bcleanser\b|\bcleansing foam\b|\bface wash\b|\bcreamy foam\b/i],
      ['Toner', /\btoner\b/i], ['Essence', /\bessence\b/i], ['Ampoule', /\bampoule\b/i],
      ['Serum', /\bserum\b/i], ['Eye Care', /\beye cream\b|\beye serum\b/i],
      ['Moisturizer', /\bmoistur|\bface cream\b|\bcapsule cream\b/i],
      ['Spot Treatment', /\bspot\b|\bacne cream\b/i], ['Exfoliant', /\bexfoliat|\bpeel\b|\bscrub\b/i],
      ['Lip Care', /\blip care\b|\blip balm\b|\blip scrub\b/i], ['Mist', /\bmist\b|\bspray serum\b/i],
      ['Foundation', /\bfoundation\b/i], ['Concealer', /\bconcealer\b/i], ['Blush', /\bblush\b/i],
      ['Mascara', /\bmascara\b/i], ['Eyeliner', /\beyeliner\b/i], ['Lip Tint', /\blip tint\b|\btint\b/i],
      ['Lipstick', /\blipstick\b/i]
    ];
    return rules.find(([, rule]) => rule.test(text || ''))?.[0] || '';
  }

  async function fetchOnlineCandidates(query, pageSize = 8) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8500);
    try {
      const fields = [
        'code','product_name','generic_name','brands','quantity','categories',
        'image_front_url','image_front_small_url','ingredients_text','ingredients_text_en'
      ].join(',');
      const url = 'https://world.openbeautyfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(query) +
        '&search_simple=1&action=process&json=1&page_size=' + pageSize + '&fields=' + encodeURIComponent(fields);
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (response.status === 429) {
        const error = new Error('rate limited');
        error.code = 429;
        throw error;
      }
      if (!response.ok) throw new Error('lookup failed');
      const json = await response.json();
      return (json.products || []).filter(product => product.product_name || product.generic_name);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function findBestOnlineProduct(query, name, brand) {
    const candidates = await fetchOnlineCandidates(query, 8);
    return candidates
      .map(product => ({ product, score: scoreMatch(name, brand, product) }))
      .sort((a, b) => b.score - a.score)[0] || null;
  }

  function enrichStoredProduct(product, match) {
    const remote = match.product;
    const ingredients = remote.ingredients_text || remote.ingredients_text_en || '';
    const source = remote.code ? 'https://world.openbeautyfacts.org/product/' + encodeURIComponent(remote.code) : '';
    if (!product.brand && remote.brands) product.brand = remote.brands;
    if (!product.size && remote.quantity) product.size = remote.quantity;
    if (!product.barcode && remote.code) product.barcode = remote.code;
    if (!product.ingredients && ingredients) product.ingredients = ingredients;
    if (!product.image) product.image = remote.image_front_url || remote.image_front_small_url || '';
    if (!product.category || product.category === 'Other') {
      const category = inferCategory([remote.product_name, remote.generic_name, remote.categories].filter(Boolean).join(' '));
      if (category) product.category = category;
    }
    product.tags = [...new Set([
      ...(Array.isArray(product.tags) ? product.tags : []),
      ...inferTags([remote.product_name, ingredients].filter(Boolean).join(' '))
    ])];
    product.sourceUrl = source || webSearchUrl([product.brand, product.name].filter(Boolean).join(' '));
    product.sourceName = source ? 'Open Beauty Facts' : 'Web Search';
    product.onlineMatchScore = Number(match.score.toFixed(3));
    product.onlineMatchStatus = source ? 'structured' : 'search-link';
    product.onlineLinkedAt = Date.now();
    product.onlineProductName = remote.product_name || '';
    product.onlineGenericName = remote.generic_name || '';
    product.onlineBrand = remote.brands || '';
    product.onlineQuantity = remote.quantity || '';
    product.onlineCategories = remote.categories || '';
    product.onlineImage = remote.image_front_url || remote.image_front_small_url || '';
    product.updatedAt = Date.now();
  }

  function attachSearchFallback(product) {
    const query = [product.brand, product.name].filter(Boolean).join(' ').trim() || product.name || '';
    product.sourceUrl = webSearchUrl(query);
    product.sourceName = 'Web Search';
    product.onlineMatchStatus = 'search-link';
    product.onlineMatchScore = null;
    product.onlineLinkedAt = Date.now();
    product.updatedAt = Date.now();
  }

  function fmtDate(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }); }
    catch (_) { return ''; }
  }

  const categoryGuides = {
    'First Cleanse': {
      what: 'A first-step cleanser made to loosen sunscreen, makeup and oil-based residue before the rest of your routine.',
      benefits: ['Removes sunscreen and makeup', 'Lifts oil-based residue', 'Prepares skin for the next cleanse'],
      step: 'Use at the beginning of cleansing, then follow with a water-based cleanser if your routine calls for one.'
    },
    'Cleanser': {
      what: 'A rinse-off cleansing step for sweat, dirt, excess oil and everyday residue.',
      benefits: ['Cleans surface impurities', 'Refreshes skin', 'Prepares skin for leave-on products'],
      step: 'Use during the cleansing step before toner, essence, serum or treatment products.'
    },
    'Toner': {
      what: 'A lightweight leave-on prep step. Its exact purpose depends on the formula and active ingredients.',
      benefits: ['Can add light hydration', 'Can refresh or prep skin', 'May deliver targeted actives'],
      step: 'Usually used after cleansing and before thicker leave-on products.'
    },
    'Essence': {
      what: 'A lightweight leave-on skincare step commonly used for hydration or targeted supportive care.',
      benefits: ['Adds lightweight hydration', 'Layers easily', 'Supports formula-specific skin goals'],
      step: 'Usually used after toner and before serum or moisturizer.'
    },
    'Serum': {
      what: 'A concentrated leave-on treatment step. The main benefits depend on its active ingredients.',
      benefits: ['Targets specific skin concerns', 'Delivers concentrated actives', 'Layers under moisturizer'],
      step: 'Usually used after toner/essence and before moisturizer.'
    },
    'Ampoule': {
      what: 'A concentrated leave-on treatment similar to a serum, often focused on a smaller set of actives.',
      benefits: ['Targeted treatment step', 'Concentrated active delivery', 'Can support hydration or tone depending on formula'],
      step: 'Usually used after toner/essence and before moisturizer.'
    },
    'Moisturizer': {
      what: 'A leave-on cream, lotion or gel designed to hydrate skin and help reduce moisture loss.',
      benefits: ['Supports hydration', 'Helps reduce moisture loss', 'Supports the skin barrier'],
      step: 'Usually used near the end of a routine, before sunscreen in the morning.'
    },
    'Eye Care': {
      what: 'A leave-on product intended for the eye-area skin. Benefits vary by formula.',
      benefits: ['Adds eye-area hydration', 'Can support smoother-looking skin', 'May target puffiness or tone depending on formula'],
      step: 'Use according to the product directions, usually before or around moisturizer.'
    },
    'Spot Treatment': {
      what: 'A targeted treatment intended for specific blemishes or small areas rather than the entire face.',
      benefits: ['Targets individual blemishes', 'Keeps treatment localized', 'Benefits depend on the active ingredient'],
      step: 'Placement varies by formula; follow the product directions for targeted use.'
    },
    'Sunscreen': {
      what: 'A daytime UV-protection step designed to reduce exposure to ultraviolet radiation.',
      benefits: ['UV protection', 'Helps prevent sun-related darkening', 'Supports long-term photoaging prevention'],
      step: 'Use as the final skincare step in the morning and reapply as directed.'
    },
    'Exfoliant': {
      what: 'A product designed to loosen or remove dead cells from the skin surface; some formulas also work within pores.',
      benefits: ['Smoother-looking texture', 'Helps reduce surface buildup', 'Benefits depend on the exfoliating ingredient'],
      step: 'Frequency varies widely. Follow the product directions and avoid stacking too many irritating actives at once.'
    },
    'Prescription / Dermatologist Treatment': {
      what: 'A dermatologist-directed treatment in your stash. The exact purpose and frequency depend on what your clinician prescribed it for.',
      benefits: ['Targeted treatment', 'Clinician-directed use', 'Benefits depend on the prescribed active'],
      step: 'Follow your prescriber’s directions rather than a generic routine order.'
    },
    'Lip Care': {
      what: 'A product for cleansing, smoothing, hydrating or protecting the lips, depending on the formula.',
      benefits: ['Lip hydration', 'Comfort and barrier support', 'Formula-specific smoothing or exfoliation'],
      step: 'Use as needed or as directed by the product.'
    },
    'Mist': {
      what: 'A fine spray used to refresh skin or deliver lightweight skincare ingredients.',
      benefits: ['Quick refresh', 'Light hydration depending on formula', 'Easy layering'],
      step: 'Use where the formula fits best—often after cleansing, between layers or during the day.'
    }
  };

  const activeBenefits = {
    'Tretinoin': ['Commonly prescribed for acne', 'Supports skin-cell turnover', 'Can improve uneven texture and post-acne marks over time'],
    'Retinal': ['Supports skin renewal', 'Texture and fine-line care', 'Can support clearer-looking skin'],
    'Retinol': ['Supports skin renewal', 'Texture and fine-line care', 'Can support clearer-looking skin'],
    'Benzoyl Peroxide': ['Targets acne-causing bacteria', 'Helps reduce inflammatory breakouts', 'Supports clearer pores'],
    'Azelaic Acid': ['Supports acne care', 'Can help redness and inflammation', 'Supports fading post-acne marks'],
    'Salicylic Acid / BHA': ['Helps unclog pores', 'Exfoliates within oily pores', 'Useful for blackheads and blemish-prone skin'],
    'AHA': ['Surface exfoliation', 'Smoother-looking texture', 'Supports more even-looking tone'],
    'Vitamin C': ['Antioxidant support', 'Brightening and even-tone care', 'Complements daytime sunscreen'],
    'Niacinamide': ['Skin-barrier support', 'Helps balance the look of oiliness', 'Supports more even-looking tone'],
    'Alpha Arbutin': ['Dark-spot care', 'Supports more even-looking tone'],
    'PDRN': ['Often used in formulas marketed for hydration and skin-repair support'],
    'Peptides': ['Supports smoother-looking skin', 'Often used for firmness-focused care'],
    'Ceramides': ['Skin-barrier support', 'Helps reduce moisture loss'],
    'Beta-Glucan': ['Hydration', 'Soothing support', 'Skin-barrier support'],
    'Tea Tree': ['Commonly used in blemish-care formulas', 'Oil-control support'],
    'Collagen': ['Hydrating or film-forming support', 'Temporarily plumper-looking skin'],
    'Hyaluronic Acid': ['Hydration', 'Helps skin feel plumper and less dry'],
    'Centella': ['Soothing support', 'Barrier-supportive care']
  };

  function displayBrand(product) {
    if (product.onlineBrand) return { label: 'Brand', value: product.onlineBrand };
    const brand = String(product.brand || '').trim();
    if (brand && norm(brand) !== norm(product.name)) return { label: 'Brand / line', value: brand };
    const parenthetical = String(product.name || '').match(/\(([^)]+)\)/);
    if (parenthetical?.[1]) return { label: 'Brand / line', value: parenthetical[1].trim() + ' · from your product name' };
    return { label: 'Brand', value: 'Not confirmed yet' };
  }

  function getGuide(product) {
    const text = [product.name, product.brand, product.category, product.ingredients, ...(product.tags || [])].filter(Boolean).join(' ');
    const detected = [...new Set([...(Array.isArray(product.tags) ? product.tags : []), ...inferTags(text)])];
    const base = categoryGuides[product.category] || {
      what: `${product.category || 'Beauty product'} in your Ichigo stash. Its exact purpose depends on the formula and active ingredients.`,
      benefits: ['Formula-specific care', 'Track how it works for your routine'],
      step: 'Use according to the product directions and where it fits in your routine.'
    };
    const activeSpecific = detected.flatMap(tag => activeBenefits[tag] || []);
    const benefits = [...new Set([...activeSpecific, ...base.benefits])].slice(0, 7);
    return { detected, what: base.what, benefits, step: base.step };
  }

  function productGuideHtml(product) {
    const guide = getGuide(product);
    const brand = displayBrand(product);
    const prescription = product.category === 'Prescription / Dermatologist Treatment' || guide.detected.includes('Tretinoin');
    return `
      <section id="ichigoProductGuide" class="section">
        <div class="section-head"><h2>About this product</h2><span class="badge lav">Ichigo guide</span></div>
        <div class="card">
          <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-bottom:14px">
            <div class="info-box"><small style="display:block;margin-bottom:4px">${esc(brand.label)}</small><strong>${esc(brand.value)}</strong></div>
            <div class="info-box"><small style="display:block;margin-bottom:4px">Product type</small><strong>${esc(product.category || 'Other')}</strong></div>
          </div>
          <div><strong>What it is</strong><p style="margin-top:5px">${esc(guide.what)}</p></div>
          <div style="margin-top:14px"><strong>What it’s good for</strong><div class="badges" style="margin-top:8px">${guide.benefits.map(item => `<span class="badge">${esc(item)}</span>`).join('')}</div></div>
          ${guide.detected.length ? `<div style="margin-top:14px"><strong>Key actives detected</strong><div class="badges" style="margin-top:8px">${guide.detected.map(item => `<span class="badge gray">${esc(item)}</span>`).join('')}</div></div>` : ''}
          <div style="margin-top:14px"><strong>Routine role</strong><p style="margin-top:5px">${esc(guide.step)}</p></div>
          ${prescription ? `<div class="notice" style="margin-top:14px">For prescription or dermatologist-directed products, Ichigo’s summary is informational only. Keep your prescriber’s instructions as the source of truth for strength, amount, frequency and combination rules.</div>` : ''}
        </div>
      </section>`;
  }

  function onlineDetailHtml(product) {
    if (!product?.sourceUrl) return '';
    const structured = product.onlineMatchStatus === 'structured' || product.sourceName === 'Open Beauty Facts';
    const linked = fmtDate(product.onlineLinkedAt);
    const confidence = Number.isFinite(Number(product.onlineMatchScore)) ? Math.round(Number(product.onlineMatchScore) * 100) + '% match' : '';
    const image = product.onlineImage || product.image || '';
    const remoteName = product.onlineProductName || product.name;
    const remoteBrand = product.onlineBrand || product.brand || '';
    const quantity = product.onlineQuantity || product.size || '';
    const ingredients = product.ingredients || '';

    if (!structured) {
      return `
        <section id="ichigoOnlineDetailPanel" class="section">
          <div class="section-head"><h2>Online source</h2><span class="badge gray">Needs exact match</span></div>
          <div class="card">
            <p>Ichigo has a web reference for this item, but it has not confirmed a structured product record yet. Your <strong>About this product</strong> summary above still works without opening the link.</p>
            ${linked ? `<p class="meta" style="margin-top:8px">Last linked ${esc(linked)}</p>` : ''}
            <div class="button-row" style="margin-top:12px"><button class="primary" id="ichigoFindExactMatch">Find exact match</button><button class="secondary" id="ichigoOpenOnlineRef">Open web source</button></div>
          </div>
        </section>`;
    }

    return `
      <section id="ichigoOnlineDetailPanel" class="section">
        <div class="section-head"><h2>Online product record</h2><span class="badge lav">Connected</span></div>
        <div class="card">
          <div style="display:flex;gap:14px;align-items:flex-start">
            ${image ? `<div class="product-thumb" style="width:88px;height:88px;flex:0 0 88px"><img src="${esc(image)}" alt=""></div>` : ''}
            <div style="min-width:0;flex:1"><span class="eyebrow">${esc(product.sourceName || 'Open Beauty Facts')}</span><h3 style="margin-top:4px">${esc(remoteName)}</h3><p style="margin-top:4px">${[remoteBrand, quantity].filter(Boolean).map(esc).join(' · ') || 'Structured online record'}</p><div class="badges" style="margin-top:8px">${confidence ? `<span class="badge lav">${esc(confidence)}</span>` : ''}${linked ? `<span class="badge gray">Linked ${esc(linked)}</span>` : ''}</div></div>
          </div>
          ${ingredients ? `<details style="margin-top:14px"><summary style="font-weight:700;cursor:pointer">Full ingredient list</summary><p style="margin-top:8px;word-break:break-word">${esc(ingredients)}</p></details>` : `<div class="notice" style="margin-top:14px">This record does not include a full ingredient list yet.</div>`}
          <div class="button-row" style="margin-top:14px"><button class="secondary" id="ichigoRefreshStructuredMatch">Refresh match</button><button class="secondary" id="ichigoViewStructuredSource">View source</button></div>
        </div>
      </section>`;
  }

  function findDetailProduct() {
    const db = readData();
    if (!db) return null;
    if (lastOpenedProductId) {
      const direct = db.products.find(product => String(product.id) === String(lastOpenedProductId));
      if (direct) return direct;
    }
    const sheet = document.getElementById('sheetContent');
    const name = sheet?.querySelector('.sheet-title h2')?.textContent?.trim();
    if (!name) return null;
    return db.products.find(product => norm(product.name) === norm(name)) || null;
  }

  function decorateProductDetail() {
    const sheet = document.getElementById('sheetContent');
    if (!sheet || !sheet.querySelector('#editProduct') || sheet.querySelector('#ichigoProductGuide')) return;
    const product = findDetailProduct();
    if (!product) return;
    const actionRow = sheet.querySelector('#editProduct')?.closest('.button-row');
    if (!actionRow) return;
    actionRow.insertAdjacentHTML('beforebegin', productGuideHtml(product) + onlineDetailHtml(product));
    const persisted = findDetailProduct() || product;
    document.getElementById('ichigoOpenOnlineRef')?.addEventListener('click', () => window.open(persisted.sourceUrl, '_blank', 'noopener'));
    document.getElementById('ichigoViewStructuredSource')?.addEventListener('click', () => window.open(persisted.sourceUrl, '_blank', 'noopener'));
    document.getElementById('ichigoFindExactMatch')?.addEventListener('click', () => openExistingMatchPicker(persisted));
    document.getElementById('ichigoRefreshStructuredMatch')?.addEventListener('click', () => openExistingMatchPicker(persisted));
    const originalFind = sheet.querySelector('#findOnline');
    if (originalFind) originalFind.textContent = 'Find exact match';
    const originalView = sheet.querySelector('#viewSource');
    if (originalView) originalView.textContent = 'View source';
  }

  function syncVisibleStashOnlineState() {
    const db = readData();
    if (!db) return;
    const byId = new Map(db.products.map(product => [String(product.id), product]));
    document.querySelectorAll('[data-product]').forEach(card => {
      const product = byId.get(String(card.dataset.product));
      if (!product) return;
      const thumb = card.querySelector('.product-thumb');
      if (thumb && product.image && !thumb.querySelector('img')) thumb.innerHTML = `<img src="${esc(product.image)}" alt="">`;
      const badges = card.querySelector('.badges');
      if (!badges) return;
      let badge = badges.querySelector('.ichigo-online-badge');
      if (!product.sourceUrl) {
        if (badge) badge.remove();
        return;
      }
      const wantedClass = product.onlineMatchStatus === 'structured' ? 'badge lav ichigo-online-badge' : 'badge gray ichigo-online-badge';
      const wantedText = product.onlineMatchStatus === 'structured' ? 'Online details' : 'Web reference';
      if (!badge) {
        badge = document.createElement('span');
        badge.className = wantedClass;
        badge.textContent = wantedText;
        badges.appendChild(badge);
        return;
      }
      if (badge.className !== wantedClass) badge.className = wantedClass;
      if (badge.textContent !== wantedText) badge.textContent = wantedText;
    });
  }

  function addBulkLinkButtonToStash() {
    const main = document.getElementById('main');
    if (!main || document.getElementById('bulkLinkStashBtn')) return;
    const heading = [...main.querySelectorAll('h1')].find(el => el.textContent.trim() === 'My Stash');
    const searchbar = main.querySelector('.searchbar');
    if (!heading || !searchbar) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'bulkLinkStashBtn';
    button.className = 'secondary';
    button.textContent = 'Link all online';
    button.addEventListener('click', startBulkLink);
    searchbar.appendChild(button);
  }

  function closeCustomSheet() {
    document.getElementById('sheetBackdrop')?.classList.add('hidden');
    document.getElementById('sheet')?.classList.add('hidden');
  }

  function openBulkSheet(total) {
    const backdrop = document.getElementById('sheetBackdrop');
    const sheet = document.getElementById('sheet');
    const content = document.getElementById('sheetContent');
    if (!backdrop || !sheet || !content) return false;
    content.innerHTML = `<div class="sheet-title"><div><h2>Link Stash Online</h2><p>Ichigo will look for structured details for products that still need them.</p></div><button class="icon-button" id="bulkCloseBtn">×</button></div><div class="notice">Searches are deliberately spaced out to respect the beauty database rate limit. Progress is saved after every item.</div><div class="card" style="margin-top:12px"><div class="section-head"><h3 id="bulkStatus">Ready</h3><strong id="bulkCounter">0 / ${total}</strong></div><div class="bar" style="margin-top:10px"><i id="bulkProgress" style="width:0%"></i></div><p id="bulkCurrent" style="margin-top:10px">Preparing your stash…</p></div><div class="button-row" style="margin-top:14px"><button class="secondary" id="bulkStopBtn">Stop safely</button></div>`;
    backdrop.classList.remove('hidden');
    sheet.classList.remove('hidden');
    document.getElementById('bulkCloseBtn')?.addEventListener('click', () => { if (bulkRunning) bulkStopRequested = true; else closeCustomSheet(); });
    document.getElementById('bulkStopBtn')?.addEventListener('click', event => { bulkStopRequested = true; event.currentTarget.disabled = true; event.currentTarget.textContent = 'Stopping…'; });
    return true;
  }

  function updateBulkProgress(done, total, text) {
    const counter = document.getElementById('bulkCounter');
    const progress = document.getElementById('bulkProgress');
    const current = document.getElementById('bulkCurrent');
    if (counter) counter.textContent = `${done} / ${total}`;
    if (progress) progress.style.width = `${total ? Math.round(done / total * 100) : 100}%`;
    if (current) current.textContent = text;
  }

  function finishBulkSheet(summary, stopped) {
    bulkRunning = false;
    const status = document.getElementById('bulkStatus');
    const current = document.getElementById('bulkCurrent');
    const row = document.querySelector('#sheetContent .button-row');
    if (status) status.textContent = stopped ? 'Stopped safely' : 'Online linking complete';
    if (current) current.textContent = `${summary.structured} exact product record${summary.structured === 1 ? '' : 's'} found · ${summary.fallback} web reference${summary.fallback === 1 ? '' : 's'} kept.`;
    if (row) row.innerHTML = '<button class="primary" id="bulkDoneBtn">Done</button><button class="secondary" id="bulkUndoBtn">Undo bulk link</button>';
    document.getElementById('bulkDoneBtn')?.addEventListener('click', () => location.reload());
    document.getElementById('bulkUndoBtn')?.addEventListener('click', undoBulkLink);
  }

  function undoBulkLink() {
    try {
      const backup = JSON.parse(localStorage.getItem(BULK_BACKUP_KEY) || 'null');
      if (!backup?.data) return alert('No bulk-link backup is available.');
      localStorage.setItem(DATA_KEY, backup.data);
      location.reload();
    } catch (_) {
      alert('Ichigo could not restore the bulk-link backup.');
    }
  }

  async function startBulkLink() {
    if (bulkRunning) return;
    if (!onlineEnabled()) return alert('Online Smart Search is turned off in Settings.');
    if (!navigator.onLine) return alert('Connect to the internet before linking your stash.');
    const db = readData();
    if (!db) return alert('Ichigo could not read your stash. Nothing was changed.');
    const candidates = db.products.filter(product => product?.name && !['Wishlist','Archived'].includes(product.status) && (!product.sourceUrl || product.onlineMatchStatus === 'search-link'));
    if (!candidates.length) return alert('Everything in your stash already has structured online details.');
    localStorage.setItem(BULK_BACKUP_KEY, JSON.stringify({ savedAt: Date.now(), data: localStorage.getItem(DATA_KEY) }));
    document.getElementById('closeDrawerBtn')?.click();
    if (!openBulkSheet(candidates.length)) return;
    bulkRunning = true;
    bulkStopRequested = false;
    const summary = { structured: 0, fallback: 0 };
    for (let i = 0; i < candidates.length; i += 1) {
      if (bulkStopRequested) break;
      const product = candidates[i];
      updateBulkProgress(i, candidates.length, `Searching ${product.name}…`);
      const query = [product.brand, product.name].filter(Boolean).join(' ').trim() || product.name;
      try {
        let best;
        try {
          best = await findBestOnlineProduct(query, product.name, product.brand || '');
        } catch (error) {
          if (error?.code === 429) {
            updateBulkProgress(i, candidates.length, 'The database asked Ichigo to slow down. Waiting before retrying…');
            await wait(65000);
            if (bulkStopRequested) break;
            best = await findBestOnlineProduct(query, product.name, product.brand || '');
          } else throw error;
        }
        if (best && best.score >= BULK_MATCH_THRESHOLD) {
          enrichStoredProduct(product, best);
          summary.structured += 1;
        } else {
          attachSearchFallback(product);
          summary.fallback += 1;
        }
      } catch (_) {
        attachSearchFallback(product);
        summary.fallback += 1;
      }
      writeData(db);
      updateBulkProgress(i + 1, candidates.length, `Updated ${product.name}`);
      if (i < candidates.length - 1 && !bulkStopRequested) await wait(BULK_SEARCH_DELAY);
    }
    finishBulkSheet(summary, bulkStopRequested);
  }

  function openExistingMatchPicker(product) {
    const backdrop = document.getElementById('sheetBackdrop');
    const sheet = document.getElementById('sheet');
    const content = document.getElementById('sheetContent');
    if (!backdrop || !sheet || !content) return;
    const query = [product.brand, product.name].filter(Boolean).join(' ').trim() || product.name;
    content.innerHTML = `<div class="sheet-title"><div><span class="eyebrow">ONLINE MATCH</span><h2>Find the exact product</h2><p>Choose a result to enrich this existing Stash entry.</p></div><button class="icon-button" id="exactClose">×</button></div><div class="searchbar"><input id="exactQuery" value="${esc(query)}"><button class="primary" id="exactSearch">Search</button></div><div class="notice">Your status, dates, quantity, notes and personal tracking stay unchanged.</div><div id="exactResults" style="margin-top:12px"></div>`;
    backdrop.classList.remove('hidden');
    sheet.classList.remove('hidden');
    document.getElementById('exactClose')?.addEventListener('click', closeCustomSheet);
    document.getElementById('exactSearch')?.addEventListener('click', () => runExactSearch(product));
    document.getElementById('exactQuery')?.addEventListener('keydown', event => { if (event.key === 'Enter') runExactSearch(product); });
    runExactSearch(product);
  }

  async function runExactSearch(product) {
    const box = document.getElementById('exactResults');
    const query = document.getElementById('exactQuery')?.value.trim();
    if (!box || !query) return;
    box.innerHTML = '<div class="empty"><p>Searching online product records…</p></div>';
    try {
      const ranked = (await fetchOnlineCandidates(query, 12)).map(candidate => ({ candidate, score: scoreMatch(product.name, product.brand || '', candidate) })).sort((a, b) => b.score - a.score);
      if (!ranked.length) {
        box.innerHTML = `<div class="empty"><h3>No structured record found</h3><p>The in-app product guide still shows what Ichigo can infer from your category and active ingredients.</p><button class="secondary" id="exactWeb">Search wider web</button></div>`;
        document.getElementById('exactWeb')?.addEventListener('click', () => window.open(webSearchUrl(query), '_blank', 'noopener'));
        return;
      }
      box.innerHTML = ranked.map((entry, index) => {
        const candidate = entry.candidate;
        const image = candidate.image_front_small_url || candidate.image_front_url || '';
        return `<article class="result-card"><div>${image ? `<img src="${esc(image)}" alt="">` : '<div class="product-thumb">🧴</div>'}</div><div><h4>${esc(candidate.product_name || candidate.generic_name || 'Unnamed product')}</h4><p>${esc(candidate.brands || '')}${candidate.quantity ? ' · ' + esc(candidate.quantity) : ''}</p><div class="badges"><span class="badge lav">Open Beauty Facts</span><span class="badge gray">${Math.round(entry.score * 100)}% name match</span></div><div class="button-row" style="margin-top:8px"><button class="primary" data-use-exact="${index}">Use this match</button></div></div></article>`;
      }).join('');
      document.querySelectorAll('[data-use-exact]').forEach(button => button.addEventListener('click', () => {
        const entry = ranked[Number(button.dataset.useExact)];
        const db = readData();
        const stored = db?.products.find(item => String(item.id) === String(product.id));
        if (!db || !stored || !entry) return;
        enrichStoredProduct(stored, { product: entry.candidate, score: entry.score });
        writeData(db);
        location.reload();
      }));
    } catch (_) {
      box.innerHTML = '<div class="empty"><h3>Online lookup is unavailable right now</h3><p>Your stash was not changed. Try again later.</p></div>';
    }
  }

  function fillOnlineFields(match) {
    const remote = match.product;
    const setIfEmpty = (selector, value) => {
      const el = document.querySelector(selector);
      if (el && !el.value && value) el.value = value;
    };
    setIfEmpty('#fBrand', remote.brands || '');
    setIfEmpty('#fSize', remote.quantity || '');
    setIfEmpty('#fBarcode', remote.code || '');
    const ingredients = remote.ingredients_text || remote.ingredients_text_en || '';
    setIfEmpty('#fIngredients', ingredients);
    const categoryEl = document.querySelector('#fCategory');
    const category = inferCategory([remote.product_name, remote.generic_name, remote.categories].filter(Boolean).join(' '));
    if (categoryEl && category && categoryEl.value === 'Other' && [...categoryEl.options].some(option => option.value === category)) categoryEl.value = category;
    const tagsEl = document.querySelector('#fTags');
    if (tagsEl) {
      const existing = tagsEl.value.split(',').map(value => value.trim()).filter(Boolean);
      tagsEl.value = [...new Set([...existing, ...inferTags([remote.product_name, ingredients].filter(Boolean).join(' '))])].join(', ');
    }
    return remote.code ? 'https://world.openbeautyfacts.org/product/' + encodeURIComponent(remote.code) : '';
  }

  document.getElementById('bulkLinkDrawerBtn')?.addEventListener('click', startBulkLink);

  const main = document.getElementById('main');
  if (main) {
    const observer = new MutationObserver(() => {
      if (mainSyncQueued) return;
      mainSyncQueued = true;
      requestAnimationFrame(() => {
        mainSyncQueued = false;
        addBulkLinkButtonToStash();
        syncVisibleStashOnlineState();
      });
    });
    observer.observe(main, { childList: true, subtree: true });
  }
  addBulkLinkButtonToStash();
  syncVisibleStashOnlineState();

  const sheetContent = document.getElementById('sheetContent');
  if (sheetContent) {
    const observer = new MutationObserver(() => {
      if (sheetDecorateQueued) return;
      sheetDecorateQueued = true;
      queueMicrotask(() => {
        sheetDecorateQueued = false;
        decorateProductDetail();
      });
    });
    observer.observe(sheetContent, { childList: true, subtree: true });
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-product-menu],[data-product]');
    if (target) lastOpenedProductId = target.dataset.productMenu || target.dataset.product || '';
  }, true);

  document.addEventListener('click', event => {
    const button = event.target.closest('#findOnline');
    if (!button) return;
    const product = findDetailProduct();
    if (!product) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openExistingMatchPicker(product);
  }, true);

  document.addEventListener('click', async event => {
    const button = event.target.closest('#saveProduct');
    if (!button || bypassAutoLookup || button.disabled) return;
    const name = document.querySelector('#fName')?.value.trim() || '';
    const brand = document.querySelector('#fBrand')?.value.trim() || '';
    const sourceEl = document.querySelector('#fSourceUrl');
    if (!name || sourceEl?.value.trim() || !onlineEnabled()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = navigator.onLine ? 'Finding online…' : 'Saving with web reference…';
    const query = [brand, name].filter(Boolean).join(' ').trim() || name;
    let sourceUrl = webSearchUrl(query);
    let best = null;
    if (navigator.onLine) {
      try {
        best = await findBestOnlineProduct(query, name, brand);
        if (best && best.score >= AUTO_MATCH_THRESHOLD) sourceUrl = fillOnlineFields(best) || sourceUrl;
        else best = null;
      } catch (_) {
        best = null;
      }
    }
    if (sourceEl) sourceEl.value = sourceUrl;
    button.disabled = false;
    button.textContent = originalText;
    bypassAutoLookup = true;
    button.click();
    bypassAutoLookup = false;
    setTimeout(() => {
      const db = readData();
      if (!db) return;
      const saved = db.products.filter(product => norm(product.name) === norm(name)).sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))[0];
      if (!saved) return;
      if (best) enrichStoredProduct(saved, best);
      else {
        saved.sourceUrl = saved.sourceUrl || sourceUrl;
        saved.sourceName = saved.sourceName || 'Web Search';
        saved.onlineMatchStatus = saved.onlineMatchStatus || 'search-link';
        saved.onlineLinkedAt = saved.onlineLinkedAt || Date.now();
      }
      writeData(db);
      syncVisibleStashOnlineState();
    }, 150);
  }, true);
})();
