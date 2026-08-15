(() => {
  'use strict';

  const DATA_KEY = 'ichigo-v1-data';
  let lastProductId = '';
  let queued = false;

  const norm = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
  const nice = value => String(value || '').trim();

  function readData() {
    try {
      const data = JSON.parse(localStorage.getItem(DATA_KEY) || '{}');
      return data && Array.isArray(data.products) ? data : null;
    } catch (_) {
      return null;
    }
  }

  function currentProduct() {
    const data = readData();
    if (!data) return null;
    if (lastProductId) {
      const byId = data.products.find(product => String(product.id) === String(lastProductId));
      if (byId) return byId;
    }
    const title = document.querySelector('#sheetContent .sheet-title h2')?.textContent?.trim();
    if (!title) return null;
    return data.products.find(product => norm(product.name) === norm(title)) || null;
  }

  function detectedActives(product) {
    const text = [
      product.name, product.brand, product.onlineProductName, product.onlineGenericName,
      product.onlineCategories, product.ingredients, ...(Array.isArray(product.tags) ? product.tags : [])
    ].filter(Boolean).join(' ');

    const rules = [
      ['tretinoin', /\btretinoin\b|\bacnoin[- ]?t\b/i],
      ['retinal', /\bretinal\b/i],
      ['retinol', /\bretinol\b/i],
      ['benzoyl peroxide', /\bbenzoyl peroxide\b|\bbenzoper\b|\bbenzac\b/i],
      ['azelaic acid', /\bazelaic\b|\bazeloyl\b/i],
      ['salicylic acid', /\bsalicylic\b|\bbha\b/i],
      ['AHA acids', /\baha\b|\bglycolic\b|\blactic acid\b|\bmandelic\b/i],
      ['vitamin C', /\bvitamin c\b|\bascorb/i],
      ['niacinamide', /\bniacinamide\b|\bniacin\b/i],
      ['alpha arbutin', /\barbutin\b/i],
      ['PDRN', /\bpdrn\b/i],
      ['beta-glucan', /\bbeta[- ]?glucan\b/i],
      ['tea tree', /\btea tree\b/i],
      ['ceramides', /\bceramide\b/i],
      ['peptides', /\bpeptide\b/i],
      ['centella', /\bcentella\b|\bcica\b/i],
      ['rice-derived ingredients', /\brice\b|\boryza sativa\b/i],
      ['collagen', /\bcollagen\b/i]
    ];
    return rules.filter(([, rule]) => rule.test(text)).map(([label]) => label);
  }

  function descriptorGoals(product) {
    const text = norm([product.name, product.onlineProductName, product.onlineGenericName].filter(Boolean).join(' '));
    const goals = [];
    const rules = [
      ['dark spots and uneven tone', /dark spot|discolor|melano|mela|bright|glow|whit/i],
      ['blemishes and acne-prone skin', /acne|blemish|pimple|pair acne/i],
      ['visible pores and rough texture', /pore|keana|texture|smooth/i],
      ['hydration and barrier support', /moisture|hydr|barrier|beta glucan/i],
      ['soothing and comfort', /sooth|calm|relief|tea tree/i],
      ['firmness and plumper-looking skin', /collagen|firm|bouncy|peptide/i],
      ['oil and congestion care', /oil|sebum|clarif|purif/i]
    ];
    rules.forEach(([label, rule]) => { if (rule.test(text) && !goals.includes(label)) goals.push(label); });
    return goals;
  }

  function productSpecificSummary(product) {
    const name = nice(product.onlineProductName || product.name) || 'This product';
    const brand = nice(product.onlineBrand || product.brand);
    const label = brand && !norm(name).startsWith(norm(brand)) ? `${brand} ${name}` : name;
    const text = norm([product.name, product.onlineProductName, product.onlineGenericName, product.onlineCategories].filter(Boolean).join(' '));
    const category = nice(product.category);
    const actives = detectedActives(product);
    const goals = descriptorGoals(product);

    if (/keana rice pack|rice pack/.test(text)) {
      return `${label} is a rice-based rinse-off facial mask used after cleansing. It is aimed at softening rough-feeling skin, improving the look of dull or uneven texture, and giving the skin a smoother, more refined appearance before the rest of your routine.`;
    }
    if (/micellar/.test(text)) {
      const active = actives.includes('salicylic acid') ? ' with salicylic acid for added pore and blemish support' : '';
      return `${label} is a no-rinse or rinse-optional micellar cleansing water${active}, made to lift sunscreen, makeup, excess oil and surface residue as a first cleansing step.`;
    }
    if (/cleansing balm/.test(text)) {
      return `${label} is an oil-rich balm cleanser that melts down sunscreen, makeup and oil-based buildup, then emulsifies with water so it can be rinsed away before a second cleanser if needed.`;
    }
    if (/cleansing oil/.test(text)) {
      return `${label} is an oil cleanser designed to dissolve sunscreen, makeup, sebum and other oil-soluble residue, then emulsify with water for rinsing.`;
    }
    if (/cleansing milk/.test(text)) {
      return `${label} is a milky rinse-off cleanser focused on gentle cleansing and comfort, removing daily dirt and residue without the feel of a strong foaming wash.`;
    }
    if (/creamy foam|cleansing foam|face wash|foam cleanser/.test(text) || category === 'Cleanser') {
      const activePhrase = actives.length ? ` Its recognizable actives include ${actives.slice(0, 2).join(' and ')}, which gives it a more targeted role beyond basic cleansing.` : '';
      return `${label} is a rinse-off facial cleanser made to remove sweat, surface oil and everyday residue while preparing the skin for leave-on skincare.${activePhrase}`;
    }
    if (/eye cream|eye serum/.test(text) || category === 'Eye Care') {
      const activePhrase = actives.length ? ` It is built around ${actives.slice(0, 2).join(' and ')}` : '';
      return `${label} is a leave-on treatment for the eye area.${activePhrase}, with the main goal of supporting hydration and smoother-looking eye-area skin while targeting formula-specific concerns such as fine lines, tone or puffiness.`;
    }
    if (/lip scrub/.test(text)) {
      return `${label} is a physical lip exfoliant used to loosen dry, flaky surface skin so the lips feel smoother before balm, tint or lipstick.`;
    }
    if (/sunscreen|sun screen|spf|uv/.test(text) || category === 'Sunscreen') {
      return `${label} is a leave-on daytime sunscreen whose primary job is UV protection. It belongs at the end of the morning skincare routine and helps reduce sun-related darkening and photoaging when used in an adequate amount and reapplied as directed.`;
    }
    if (actives.includes('tretinoin')) {
      return `${label} is a topical tretinoin treatment—a prescription retinoid used for acne and skin-cell turnover. It is a treatment product rather than a moisturizer, and its strength, amount and schedule should follow the directions given by the prescriber.`;
    }
    if (actives.includes('benzoyl peroxide')) {
      return `${label} is an acne-treatment product centered on benzoyl peroxide, an active used to reduce acne-causing bacteria and inflammatory breakouts. It can be drying or irritating, so its exact placement and frequency depend on the formula and your treatment plan.`;
    }
    if (actives.includes('azelaic acid') && /serum|ampoule|cream|toner|solution/.test(text)) {
      return `${label} is a leave-on azelaic-acid treatment aimed at acne-prone skin, redness and post-acne discoloration. Its role is targeted treatment rather than basic hydration alone.`;
    }
    if (actives.includes('retinal') || actives.includes('retinol')) {
      const retinoid = actives.includes('retinal') ? 'retinal' : 'retinol';
      return `${label} is a leave-on ${retinoid} treatment focused on skin renewal, texture and fine-line care. Because ${retinoid} is a retinoid, it is usually treated as an active step rather than a simple hydrating product.`;
    }
    if (actives.includes('alpha arbutin')) {
      return `${label} is a leave-on discoloration-care product centered on alpha arbutin, used to support a more even-looking tone and gradually improve the appearance of dark or post-acne marks.`;
    }
    if (actives.includes('beta-glucan')) {
      return `${label} is a hydration-focused leave-on treatment centered on beta-glucan, with a strong emphasis on moisture, soothing support and helping the skin barrier feel more comfortable.`;
    }
    if (actives.includes('PDRN')) {
      const type = category ? category.toLowerCase() : 'leave-on treatment';
      return `${label} is a ${type} built around PDRN in a repair- and hydration-focused formula. Its main role is supportive care for moisture, comfort and plumper-looking skin rather than exfoliation or acne medication.`;
    }
    if (actives.includes('vitamin C')) {
      return `${label} is a vitamin-C-focused ${category ? category.toLowerCase() : 'skincare treatment'} aimed at antioxidant support, brighter-looking skin and a more even-looking tone.`;
    }
    if (actives.includes('niacinamide')) {
      return `${label} is a niacinamide-focused ${category ? category.toLowerCase() : 'leave-on skincare product'} designed around barrier support, oil-balance support and a more even-looking tone.`;
    }

    const typeMap = {
      'Toner':'lightweight leave-on toner', 'Essence':'lightweight leave-on essence', 'Serum':'concentrated leave-on serum',
      'Ampoule':'concentrated leave-on ampoule', 'Moisturizer':'leave-on moisturizer', 'Wash-Off Mask':'rinse-off treatment mask',
      'Sheet Mask':'essence-soaked sheet mask', 'Sleeping Mask':'overnight leave-on mask', 'Spot Treatment':'targeted spot treatment',
      'Acne Treatment':'targeted acne treatment', 'Mist':'fine skincare mist', 'Facial Oil':'leave-on facial oil'
    };
    const type = typeMap[category] || (category ? category.toLowerCase() : 'beauty product');
    const activeText = actives.length ? ` It contains or is named around ${actives.slice(0, 3).join(', ')}, which makes the formula especially relevant to ${goals.length ? goals.slice(0, 2).join(' and ') : 'its targeted skincare role'}.` : '';
    const goalText = !actives.length && goals.length ? ` Its name and saved product details point mainly to ${goals.slice(0, 2).join(' and ')}.` : '';
    return `${label} is a ${type} in your Ichigo collection, not just a generic ${category || 'beauty'} item.${activeText}${goalText}`;
  }

  function applySpecificSummary() {
    const guide = document.getElementById('ichigoProductGuide');
    if (!guide) return;
    const product = currentProduct();
    if (!product) return;

    const heading = [...guide.querySelectorAll('strong')].find(el => el.textContent.trim() === 'What it is');
    const paragraph = heading?.parentElement?.querySelector('p');
    if (!paragraph) return;

    const summary = productSpecificSummary(product);
    if (paragraph.textContent !== summary) paragraph.textContent = summary;
    paragraph.dataset.productSpecific = '1';
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-product-menu],[data-product]');
    if (target) lastProductId = target.dataset.productMenu || target.dataset.product || '';
  }, true);

  const sheet = document.getElementById('sheetContent');
  if (sheet) {
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        applySpecificSummary();
      });
    }).observe(sheet, { childList:true, subtree:true });
  }

  applySpecificSummary();
})();
