(() => {
  'use strict';

  const DATA_KEY = 'ichigo-v1-data';
  let lastProductId = '';
  let decorateQueued = false;
  let mainQueued = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
  const norm = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
  const unique = values => [...new Set(values.filter(Boolean))];

  const ingredientRules = [
    ['Tretinoin', /\btretinoin\b/i], ['Retinal', /\bretinal\b/i], ['Retinol', /\bretinol\b/i],
    ['Benzoyl Peroxide', /\bbenzoyl peroxide\b|\bbenzoper\b/i], ['Azelaic Acid', /\bazelaic\b|\bazeloyl\b/i],
    ['Salicylic Acid / BHA', /\bsalicylic\b|\bbha\b/i], ['AHA', /\baha\b|\bglycolic\b|\blactic acid\b|\bmandelic\b/i],
    ['Vitamin C', /\bvitamin c\b|\bascorb/i], ['Niacinamide', /\bniacinamide\b|\bniacin\b/i],
    ['Alpha Arbutin', /\barbutin\b/i], ['PDRN', /\bpdrn\b/i], ['Peptides', /\bpeptide\b/i],
    ['Ceramides', /\bceramide\b/i], ['Beta-Glucan', /\bbeta[- ]?glucan\b/i], ['Tea Tree', /\btea tree\b/i],
    ['Collagen', /\bcollagen\b/i], ['Hyaluronic Acid', /\bhyaluronic\b|\bsodium hyaluronate\b/i],
    ['Centella', /\bcentella\b|\bcica\b/i], ['Rice', /\brice\b|\boryza sativa\b/i]
  ];

  const ingredientInfo = {
    'Tretinoin': { good:['Acne care','Skin-cell turnover','Uneven texture','Post-acne mark support'], concerns:['Acne','Texture','Post-acne marks'], note:'Prescription retinoid; dryness, peeling and irritation can occur, especially while adjusting.' },
    'Retinal': { good:['Skin renewal','Texture care','Fine-line care','Clearer-looking skin'], concerns:['Texture','Fine lines','Blemish-prone skin'], note:'A retinoid that can be irritating for some skin; introduce according to the product directions.' },
    'Retinol': { good:['Skin renewal','Texture care','Fine-line care','Clearer-looking skin'], concerns:['Texture','Fine lines','Blemish-prone skin'], note:'A retinoid that can cause dryness or irritation, especially when starting.' },
    'Benzoyl Peroxide': { good:['Targets acne-causing bacteria','Inflammatory breakout care','Pore-clearing support'], concerns:['Inflamed pimples','Acne'], note:'Can be drying or irritating and may bleach fabrics.' },
    'Azelaic Acid': { good:['Acne care','Redness support','Post-acne mark care','More even-looking tone'], concerns:['Acne','Redness','Post-acne marks'], note:'Can tingle or irritate some skin, particularly with stronger formulas.' },
    'Salicylic Acid / BHA': { good:['Helps unclog pores','Blackhead care','Oil-control support','Blemish care'], concerns:['Blackheads','Clogged pores','Oiliness','Blemishes'], note:'Overuse can cause dryness or irritation.' },
    'AHA': { good:['Surface exfoliation','Smoother-looking texture','More even-looking tone'], concerns:['Rough texture','Dullness','Uneven tone'], note:'Exfoliating acids can increase irritation if stacked too aggressively with other strong actives.' },
    'Vitamin C': { good:['Antioxidant support','Brightening','Even-tone care','Daytime antioxidant support'], concerns:['Dullness','Uneven tone','Dark spots'], note:'Stability and irritation potential depend on the vitamin C form and concentration.' },
    'Niacinamide': { good:['Barrier support','Oil-balance support','More even-looking tone','Redness support'], concerns:['Oiliness','Uneven tone','Barrier support'], note:'Usually well tolerated, though high-strength formulas can irritate some skin.' },
    'Alpha Arbutin': { good:['Dark-spot care','Even-tone support'], concerns:['Dark spots','Post-acne marks','Uneven tone'], note:'Results are gradual and depend on the full formula and consistent sun protection.' },
    'PDRN': { good:['Hydration support','Comforting care','Repair-focused formula support'], concerns:['Dryness','Dehydration','Barrier support'], note:'Topical PDRN products vary widely; benefits depend on the complete formula.' },
    'Peptides': { good:['Smoother-looking skin','Firmness-focused care','Barrier-supportive formulas'], concerns:['Fine lines','Firmness','Barrier support'], note:'Peptide effects vary by peptide type and formula.' },
    'Ceramides': { good:['Barrier support','Helps reduce moisture loss','Dryness support'], concerns:['Dryness','Compromised barrier'], note:'Especially useful in formulas designed to support the skin barrier.' },
    'Beta-Glucan': { good:['Hydration','Soothing support','Barrier support'], concerns:['Dryness','Sensitivity','Dehydration'], note:'Often included in soothing and hydrating formulas.' },
    'Tea Tree': { good:['Blemish-care support','Oil-control support'], concerns:['Blemishes','Oiliness'], note:'Fragrant plant extracts can irritate some sensitive skin.' },
    'Collagen': { good:['Hydrating support','Film-forming support','Temporarily plumper-looking skin'], concerns:['Dryness','Dehydration'], note:'Topical collagen mainly works as a hydrating or film-forming ingredient rather than replacing skin collagen.' },
    'Hyaluronic Acid': { good:['Hydration','Plumper-looking skin','Dehydration support'], concerns:['Dryness','Dehydration'], note:'A humectant that helps bind water in the formula and skin surface.' },
    'Centella': { good:['Soothing support','Barrier-supportive care','Redness comfort'], concerns:['Sensitivity','Redness','Barrier support'], note:'Benefits depend on the amount and type of Centella-derived ingredients used.' },
    'Rice': { good:['Hydration support','Softening care','Antioxidant-supportive formulas'], concerns:['Dullness','Dryness','Texture'], note:'Rice-derived ingredients vary; the exact benefit depends on the extract and full formula.' }
  };

  const categoryInfo = {
    'First Cleanse': { what:'A first cleansing step designed to dissolve sunscreen, makeup and oil-based residue.', benefits:['Removes sunscreen and makeup','Lifts oil-based residue','Prepares skin for the next cleanse'], concerns:['Makeup removal','Sunscreen removal'], step:'First cleansing step', when:'AM or PM as needed', frequency:'Use when you need to remove sunscreen, makeup or heavier residue.' },
    'Cleanser': { what:'A rinse-off cleansing product for sweat, dirt, excess oil and everyday residue.', benefits:['Cleans surface impurities','Refreshes skin','Prepares skin for leave-on products'], concerns:['Daily cleansing'], step:'Cleanse before leave-on skincare', when:'AM and/or PM', frequency:'Use according to your skin needs and product directions.' },
    'Toner': { what:'A lightweight leave-on prep step. Its exact role depends on the formula and active ingredients.', benefits:['Light hydration','Skin prep','Can deliver targeted actives'], concerns:['Hydration','Formula-specific concerns'], step:'After cleansing, before essence/serum', when:'AM and/or PM', frequency:'Often daily, unless it contains stronger exfoliating or treatment actives.' },
    'Essence': { what:'A lightweight leave-on skincare layer commonly used for hydration or supportive treatment.', benefits:['Lightweight hydration','Easy layering','Formula-specific targeted care'], concerns:['Hydration','Barrier support'], step:'After toner, before serum', when:'AM and/or PM', frequency:'Usually suitable for regular use if the formula is gentle.' },
    'Serum': { what:'A concentrated leave-on treatment step aimed at one or more specific skin concerns.', benefits:['Targeted treatment','Concentrated active delivery','Layers under moisturizer'], concerns:['Depends on active ingredients'], step:'After toner/essence, before moisturizer', when:'AM and/or PM depending on actives', frequency:'Follow the active ingredients and label directions.' },
    'Ampoule': { what:'A concentrated leave-on treatment similar to a serum, often focused on a smaller set of actives.', benefits:['Targeted care','Concentrated formula','Hydration or tone support depending on actives'], concerns:['Depends on active ingredients'], step:'After toner/essence, before moisturizer', when:'AM and/or PM depending on actives', frequency:'Use according to the formula and your routine.' },
    'Moisturizer': { what:'A leave-on cream, lotion or gel that hydrates skin and helps reduce moisture loss.', benefits:['Hydration','Barrier support','Helps reduce moisture loss'], concerns:['Dryness','Dehydration','Barrier support'], step:'Near the end of skincare', when:'AM and/or PM', frequency:'Usually daily; apply before sunscreen in the morning.' },
    'Eye Care': { what:'A leave-on product designed for the eye-area skin.', benefits:['Eye-area hydration','Smoother-looking skin','Formula-specific puffiness or tone care'], concerns:['Dryness around eyes','Fine lines','Puffiness'], step:'Before or around moisturizer', when:'AM and/or PM', frequency:'Use as directed and avoid getting the product into the eyes.' },
    'Spot Treatment': { what:'A targeted treatment intended for individual blemishes or small areas.', benefits:['Localized blemish care','Targeted active delivery'], concerns:['Individual blemishes','Acne'], step:'Targeted treatment step', when:'Depends on active ingredient', frequency:'Follow the product directions; stronger spot treatments may not need frequent use.' },
    'Acne Treatment': { what:'A treatment product intended to help manage acne or blemish-prone skin.', benefits:['Blemish care','Pore support','Formula-specific acne treatment'], concerns:['Acne','Blemishes','Clogged pores'], step:'Treatment step', when:'Depends on active ingredient', frequency:'Follow the active ingredient and product directions.' },
    'Sunscreen': { what:'A daytime UV-protection product designed to reduce exposure to ultraviolet radiation.', benefits:['UV protection','Helps prevent sun-related darkening','Photoaging prevention support'], concerns:['UV exposure','Dark-spot prevention'], step:'Final morning skincare step', when:'AM / daytime', frequency:'Apply every day when exposed to daylight and reapply as directed.' },
    'Exfoliant': { what:'A product designed to loosen or remove dead skin cells; some formulas also work within oily pores.', benefits:['Smoother-looking texture','Helps reduce buildup','Formula-specific pore or tone support'], concerns:['Rough texture','Clogged pores','Dullness'], step:'Treatment/exfoliation step', when:'Often PM, depending on formula', frequency:'Follow label directions; avoid increasing frequency too quickly.' },
    'Wash-Off Mask': { what:'A rinse-off treatment mask left on the skin for a set time, then washed away.', benefits:['Occasional targeted treatment','Can soften or smooth skin','Formula-specific hydration, oil or pore care'], concerns:['Texture','Dullness','Hydration','Formula-specific concerns'], step:'After cleansing, before leave-on skincare', when:'AM or PM', frequency:'Usually occasional rather than every routine; follow the label for timing and frequency.' },
    'Sheet Mask': { what:'A single-use sheet saturated with essence for short-term hydration and formula-specific care.', benefits:['Hydration boost','Comforting care','Temporary plumping'], concerns:['Dryness','Dehydration','Sensitivity'], step:'After cleansing/toner, before moisturizer', when:'AM or PM', frequency:'Use as desired or directed; remove before the sheet dries out completely.' },
    'Sleeping Mask': { what:'An overnight leave-on mask used as one of the final steps of an evening routine.', benefits:['Overnight hydration','Barrier support','Formula-specific treatment'], concerns:['Dryness','Dehydration'], step:'Final or near-final PM step', when:'PM', frequency:'Use according to formula and skin needs.' },
    'Lip Care': { what:'A product for hydrating, smoothing, protecting or exfoliating the lips.', benefits:['Lip hydration','Barrier support','Formula-specific smoothing'], concerns:['Dry lips','Flaking'], step:'Lip-care step', when:'Any time', frequency:'Use as needed or as directed.' },
    'Mist': { what:'A fine spray used to refresh skin or deliver lightweight skincare ingredients.', benefits:['Quick refresh','Light hydration','Easy layering'], concerns:['Dehydration','Comfort'], step:'Flexible lightweight step', when:'AM, PM or during the day', frequency:'Use as needed unless it contains stronger actives.' },
    'Facial Oil': { what:'A leave-on oil or oil blend used mainly for emollience and reducing moisture loss.', benefits:['Softens skin','Helps seal in moisture','Supports dry-skin comfort'], concerns:['Dryness','Flaking'], step:'Usually near the end of skincare', when:'AM or PM', frequency:'Use according to skin needs and formula.' },
    'Prescription / Dermatologist Treatment': { what:'A dermatologist-directed treatment in your stash. Its exact purpose, strength and schedule depend on what was prescribed.', benefits:['Clinician-directed treatment','Targeted active therapy'], concerns:['Depends on prescription'], step:'Follow your prescriber’s instructions', when:'Follow your prescriber’s instructions', frequency:'Follow your prescriber’s instructions rather than a generic app schedule.' },
    'Primer': { what:'A makeup-prep product applied before complexion makeup to change finish, grip or texture.', benefits:['Makeup prep','Can smooth or grip','Can modify finish'], concerns:['Makeup wear'], step:'After skincare/sunscreen, before makeup', when:'When wearing makeup', frequency:'As needed.' },
    'Foundation': { what:'A complexion makeup product used to even the appearance of skin tone and provide coverage.', benefits:['Complexion coverage','More even-looking tone','Finish control'], concerns:['Coverage','Makeup finish'], step:'After primer/skincare', when:'When wearing makeup', frequency:'As needed.' },
    'Concealer': { what:'A targeted complexion product used to cover specific areas such as blemishes or under-eyes.', benefits:['Targeted coverage','Brightening or correction depending on shade'], concerns:['Blemish coverage','Under-eye coverage'], step:'With or after base makeup', when:'When wearing makeup', frequency:'As needed.' },
    'Blush': { what:'A color cosmetic used to add flush and dimension to the cheeks.', benefits:['Adds color','Adds dimension'], concerns:['Makeup color'], step:'Complexion color step', when:'When wearing makeup', frequency:'As needed.' },
    'Lip Tint': { what:'A lip color product designed to leave a tint or stain on the lips.', benefits:['Lip color','Longer-wearing stain depending on formula'], concerns:['Lip makeup'], step:'Lip makeup step', when:'Any time', frequency:'As needed.' },
    'Lipstick': { what:'A lip color product that adds pigment and finish to the lips.', benefits:['Lip color','Finish and definition'], concerns:['Lip makeup'], step:'Lip makeup step', when:'Any time', frequency:'As needed.' }
  };

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

  function detectedIngredients(product) {
    const text = [product.name, product.brand, product.onlineProductName, product.onlineGenericName, product.onlineCategories, product.ingredients, ...(product.tags || [])].filter(Boolean).join(' ');
    const inferred = ingredientRules.filter(([, rule]) => rule.test(text)).map(([name]) => name);
    return unique([...(Array.isArray(product.tags) ? product.tags : []), ...inferred]);
  }

  function getProduct() {
    const db = readData();
    if (!db) return null;
    if (lastProductId) {
      const byId = db.products.find(item => String(item.id) === String(lastProductId));
      if (byId) return byId;
    }
    const name = document.querySelector('#sheetContent .sheet-title h2')?.textContent?.trim();
    if (!name) return null;
    return db.products.find(item => norm(item.name) === norm(name)) || null;
  }

  function buildGuide(product) {
    const category = categoryInfo[product.category] || {
      what:`${product.category || 'Beauty product'} in your Ichigo stash. Its exact purpose depends on the formula and ingredients.`,
      benefits:['Formula-specific care','Personal beauty tracking'], concerns:['Depends on formula'],
      step:'Use where it fits in your routine.', when:'Depends on product', frequency:'Follow the product directions.'
    };
    const actives = detectedIngredients(product);
    const activeBenefits = actives.flatMap(name => ingredientInfo[name]?.good || []);
    const activeConcerns = actives.flatMap(name => ingredientInfo[name]?.concerns || []);
    const notes = actives.map(name => ingredientInfo[name]?.note).filter(Boolean);
    const benefits = unique([...activeBenefits, ...category.benefits]).slice(0, 10);
    const concerns = unique([...activeConcerns, ...category.concerns]).slice(0, 8);

    let when = category.when;
    if (actives.some(name => ['Tretinoin','Retinal','Retinol'].includes(name))) when = 'Usually PM unless your prescriber/product directions say otherwise';
    if (product.category === 'Sunscreen') when = 'AM / daytime';

    const prescription = product.category === 'Prescription / Dermatologist Treatment' || actives.includes('Tretinoin');
    return { category, actives, benefits, concerns, notes:unique(notes).slice(0,4), when, prescription };
  }

  function richGuideHtml(product) {
    const guide = buildGuide(product);
    const structured = product.onlineMatchStatus === 'structured' || product.sourceName === 'Open Beauty Facts';
    const webImage = structured ? String(product.onlineImage || '').trim() : '';
    const brand = product.onlineBrand || product.brand || 'Not confirmed yet';
    const size = product.onlineQuantity || product.size || 'Not listed';
    const onlineName = product.onlineProductName || '';
    const ingredientCount = String(product.ingredients || '').split(',').map(x => x.trim()).filter(Boolean).length;

    return `
      <div class="section-head"><h2>About this product</h2><span class="badge lav">Ichigo guide</span></div>
      <div class="card">
        ${webImage ? `
          <div style="display:flex;gap:14px;align-items:center;margin-bottom:16px">
            <div class="product-thumb" style="width:104px;height:104px;flex:0 0 104px"><img src="${esc(webImage)}" alt="${esc(product.name)} product photo"></div>
            <div style="min-width:0;flex:1"><span class="eyebrow">WEB PRODUCT PHOTO</span><strong style="display:block;margin-top:5px">${esc(onlineName || product.name)}</strong><p style="margin-top:4px">${esc(brand)}${size !== 'Not listed' ? ' · ' + esc(size) : ''}</p></div>
          </div>` : ''}

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px">
          <div class="info-box"><small style="display:block;margin-bottom:4px">Brand</small><strong>${esc(brand)}</strong></div>
          <div class="info-box"><small style="display:block;margin-bottom:4px">Product type</small><strong>${esc(product.category || 'Other')}</strong></div>
          <div class="info-box"><small style="display:block;margin-bottom:4px">Size</small><strong>${esc(size)}</strong></div>
          <div class="info-box"><small style="display:block;margin-bottom:4px">Online status</small><strong>${structured ? 'Confirmed product record' : (product.sourceUrl ? 'Web reference only' : 'Not linked yet')}</strong></div>
        </div>

        <div><strong>What it is</strong><p style="margin-top:5px">${esc(guide.category.what)}</p></div>

        <div style="margin-top:16px"><strong>Main benefits</strong><div class="badges" style="margin-top:8px">${guide.benefits.map(item => `<span class="badge">${esc(item)}</span>`).join('')}</div></div>

        <div style="margin-top:16px"><strong>Common concerns it may fit</strong><div class="badges" style="margin-top:8px">${guide.concerns.map(item => `<span class="badge gray">${esc(item)}</span>`).join('')}</div></div>

        ${guide.actives.length ? `<div style="margin-top:16px"><strong>Key ingredients / actives</strong><div style="display:grid;gap:8px;margin-top:8px">${guide.actives.map(name => {
          const info = ingredientInfo[name];
          return `<div class="info-box"><strong>${esc(name)}</strong>${info?.good?.length ? `<p style="margin-top:4px">${esc(info.good.slice(0,3).join(' · '))}</p>` : ''}</div>`;
        }).join('')}</div></div>` : ''}

        <div style="margin-top:16px;display:grid;gap:10px">
          <div><strong>Routine placement</strong><p style="margin-top:5px">${esc(guide.category.step)}</p></div>
          <div><strong>When to use</strong><p style="margin-top:5px">${esc(guide.when)}</p></div>
          <div><strong>How often</strong><p style="margin-top:5px">${esc(guide.category.frequency)}</p></div>
        </div>

        ${ingredientCount ? `<div style="margin-top:16px"><strong>Formula snapshot</strong><p style="margin-top:5px">Ichigo has an ingredient list saved for this product with about ${ingredientCount} listed ingredient${ingredientCount === 1 ? '' : 's'}. Open the ingredient section below for the full INCI text.</p></div>` : ''}

        ${guide.notes.length ? `<div style="margin-top:16px"><strong>Things to know</strong><div style="display:grid;gap:8px;margin-top:8px">${guide.notes.map(note => `<div class="notice">${esc(note)}</div>`).join('')}</div></div>` : ''}

        ${structured ? `<div class="notice" style="margin-top:16px">Brand, size and product photo above come from the confirmed online product record when available. Benefit and routine notes are Ichigo’s ingredient/category guide, not marketing claims copied from the source.</div>` : `<div class="notice" style="margin-top:16px">This product is not yet matched to a confirmed online record, so the guide is based on the product name, category and ingredients you already have saved.</div>`}

        ${guide.prescription ? `<div class="notice" style="margin-top:10px">For prescription or dermatologist-directed products, your prescriber’s instructions remain the source of truth for strength, amount, frequency and combination rules.</div>` : ''}
      </div>`;
  }

  async function ensureConfirmedWebImage(product) {
    const structured = product.onlineMatchStatus === 'structured' || product.sourceName === 'Open Beauty Facts';
    if (!structured || product.onlineImage || !navigator.onLine) return;
    let code = String(product.barcode || '').trim();
    if (!code && product.sourceUrl) {
      const match = String(product.sourceUrl).match(/\/product\/([^/?#]+)/i);
      if (match) code = decodeURIComponent(match[1]);
    }
    if (!code) return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const url = 'https://world.openbeautyfacts.org/api/v2/product/' + encodeURIComponent(code) + '.json?fields=code,product_name,brands,quantity,image_front_url,image_front_small_url';
      const response = await fetch(url, { signal: controller.signal, headers:{ Accept:'application/json' } });
      clearTimeout(timeout);
      if (!response.ok) return;
      const json = await response.json();
      const remote = json.product || {};
      const image = remote.image_front_url || remote.image_front_small_url || '';
      if (!image) return;
      const db = readData();
      const stored = db?.products.find(item => String(item.id) === String(product.id));
      if (!db || !stored) return;
      stored.onlineImage = image;
      if (!stored.image) stored.image = image;
      if (!stored.onlineProductName && remote.product_name) stored.onlineProductName = remote.product_name;
      if (!stored.onlineBrand && remote.brands) stored.onlineBrand = remote.brands;
      if (!stored.onlineQuantity && remote.quantity) stored.onlineQuantity = remote.quantity;
      stored.updatedAt = Date.now();
      writeData(db);
      decorateDetail(true);
      syncStashPhotos();
    } catch (_) {
      // A missing web photo should never block the product detail screen.
    }
  }

  function decorateDetail(force = false) {
    const guideEl = document.getElementById('ichigoProductGuide');
    if (!guideEl) return;
    if (!force && guideEl.dataset.richGuide === '1') return;
    const product = getProduct();
    if (!product) return;
    guideEl.innerHTML = richGuideHtml(product);
    guideEl.dataset.richGuide = '1';
    ensureConfirmedWebImage(product);
  }

  function syncStashPhotos() {
    const db = readData();
    if (!db) return;
    const byId = new Map(db.products.map(item => [String(item.id), item]));
    document.querySelectorAll('[data-product]').forEach(card => {
      const product = byId.get(String(card.dataset.product));
      if (!product) return;
      const structured = product.onlineMatchStatus === 'structured' || product.sourceName === 'Open Beauty Facts';
      const image = structured ? (product.onlineImage || product.image || '') : (product.image || '');
      if (!image) return;
      const thumb = card.querySelector('.product-thumb');
      if (thumb && !thumb.querySelector('img')) thumb.innerHTML = `<img src="${esc(image)}" alt="${esc(product.name)}">`;
    });
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-product-menu],[data-product]');
    if (target) lastProductId = target.dataset.productMenu || target.dataset.product || '';
  }, true);

  const sheet = document.getElementById('sheetContent');
  if (sheet) {
    new MutationObserver(() => {
      if (decorateQueued) return;
      decorateQueued = true;
      requestAnimationFrame(() => {
        decorateQueued = false;
        decorateDetail();
      });
    }).observe(sheet, { childList:true, subtree:true });
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
    }).observe(main, { childList:true, subtree:true });
  }

  decorateDetail();
  syncStashPhotos();
})();
