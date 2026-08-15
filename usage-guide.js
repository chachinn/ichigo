(() => {
  'use strict';

  const DATA_KEY = 'ichigo-v1-data';
  let lastProductId = '';
  let queued = false;

  const norm = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

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

  function productText(product) {
    return norm([
      product.name,
      product.brand,
      product.onlineProductName,
      product.onlineGenericName,
      product.onlineCategories,
      product.category,
      product.ingredients,
      ...(Array.isArray(product.tags) ? product.tags : [])
    ].filter(Boolean).join(' '));
  }

  function howToUse(product) {
    const text = productText(product);
    const category = String(product.category || '').trim();

    // Prescription tretinoin: keep the app aligned with standard topical tretinoin labeling,
    // while making the user's prescriber the source of truth.
    if (/\btretinoin\b|\bacnoin t\b/.test(text)) {
      return 'Use only as prescribed. Standard topical tretinoin directions generally call for gentle cleansing first, then letting the skin dry completely for about 20–30 minutes before applying a light, thin layer to the affected area at bedtime. Keep it away from the eyes, lips, corners of the nose and broken skin. Do not use more or apply it more often than your prescriber directs, and use daytime sun protection.';
    }

    if (/benzoyl peroxide|benzoper|benzac/.test(text)) {
      if (/wash|cleanser|foam/.test(text) || category === 'Cleanser') {
        return 'Use as an acne-cleansing step according to the package or prescriber directions. Wet the treatment area if the label instructs, massage the wash gently, leave it on only for the label-directed contact time, then rinse thoroughly and pat dry. Avoid the eyes and lips. Benzoyl peroxide can dry or irritate skin and may bleach towels, pillowcases or clothing.';
      }
      return 'Apply a thin layer to the acne-prone or affected area after gentle cleansing, following the package or prescriber directions for frequency. Avoid the eyes, lips and broken skin, wash your hands after applying, and use moisturizer if dryness develops. Benzoyl peroxide can bleach fabrics.';
    }

    if (/sunscreen|sun screen|\bspf\b|\buv\b/.test(text) || category === 'Sunscreen') {
      return 'Apply generously and evenly as the final morning skincare step, about 15 minutes before sun exposure. Cover all exposed skin and reapply at least every 2 hours, and more often after swimming, sweating or towel drying according to the product’s water-resistance directions.';
    }

    if (/cleansing balm/.test(text) || category === 'First Cleanse' && /balm/.test(text)) {
      return 'With dry hands, massage a small amount over a dry face to loosen sunscreen, makeup and oil-based residue. Add a little water and continue massaging until the balm turns milky, then rinse thoroughly. Follow with a water-based cleanser if you want or need a second cleanse.';
    }

    if (/cleansing oil/.test(text) || category === 'First Cleanse' && /oil/.test(text)) {
      return 'Apply to dry hands and a dry face, massage gently to dissolve sunscreen, makeup and oil-based residue, then add water to emulsify it into a milky texture. Rinse thoroughly and follow with a water-based cleanser if you want or need a second cleanse.';
    }

    if (/micellar/.test(text)) {
      return 'Saturate a cotton pad and gently wipe over the skin to lift makeup, sunscreen and surface residue; repeat with fresh pads as needed. Rinse afterward if the product label instructs you to, or follow with a regular cleanser when you want a second cleanse. Avoid rubbing or scrubbing the skin.';
    }

    if (/cleansing milk/.test(text)) {
      return 'Massage gently over the face using the amount and wet/dry-skin method stated on the label, then rinse or remove it as directed. Pat the skin dry rather than rubbing, then continue with leave-on skincare.';
    }

    if (/lip scrub/.test(text)) {
      return 'Use a small amount on damp lips and massage very gently to loosen flaky surface skin, then rinse or wipe it away and follow with lip balm. Do not scrub cracked, bleeding or irritated lips, and use only as often as the product label recommends.';
    }

    if (/eye cream|eye serum/.test(text) || category === 'Eye Care') {
      return 'Use a very small amount around the orbital area after lighter skincare layers and before or with moisturizer, depending on the formula. Tap or smooth it on gently without pulling the skin, and keep it out of the eyes unless the product specifically says it is safe for closer application.';
    }

    if (/wash off mask|rice pack|keana rice|\bpack\b/.test(text) || category === 'Wash-Off Mask') {
      return 'After cleansing, spread an even layer over the face while avoiding the eye and lip areas. Leave it on only for the amount of time stated on the product label, then rinse thoroughly with lukewarm water and continue with your leave-on skincare. Use it only as often as the packaging recommends.';
    }

    if (category === 'Sheet Mask' || /sheet mask/.test(text)) {
      return 'Apply the sheet to clean skin after cleansing and, if you use one, toner. Leave it on for the time stated on the package, remove it before it dries completely, then gently pat in the remaining essence and follow with moisturizer if needed. Do not reuse the sheet.';
    }

    if (category === 'Sleeping Mask' || /sleeping mask|overnight mask/.test(text)) {
      return 'Apply in the evening as one of the final steps of your routine, usually after serums and moisturizer or in place of the final cream if the label directs. Leave it on overnight and cleanse normally in the morning. Follow the product’s recommended frequency.';
    }

    if (/azelaic|azeloyl/.test(text)) {
      return 'Apply a thin, even layer to clean, dry skin as a leave-on treatment, usually before moisturizer. Keep it away from the eyes and lips and follow the product label or prescriber’s directions for frequency, especially if the formula also contains exfoliating acids.';
    }

    if (/\bretinal\b|\bretinol\b/.test(text)) {
      return 'Use as an evening leave-on treatment unless the label says otherwise. Apply a thin layer after cleansing and before moisturizer, and introduce it at the frequency recommended on the package rather than increasing use quickly. Avoid the eye and lip areas unless the product is specifically made for them, and use sunscreen during the day.';
    }

    if (/salicylic|\bbha\b|\bglycolic\b|\blactic acid\b|\bmandelic\b|\baha\b/.test(text) && !/cleanser|wash|foam/.test(text)) {
      return 'Use as a leave-on exfoliating treatment after cleansing and before moisturizer, following the label for amount and frequency. Avoid the eye and lip areas and do not increase frequency just because the skin feels comfortable at first. If you use other potentially irritating actives, space them out unless your dermatologist or the product directions say they can be combined.';
    }

    if (/vitamin c|ascorb/.test(text)) {
      return 'Apply a thin layer after cleansing (and toner/essence if used) and before moisturizer. Many vitamin C products fit well in the morning under sunscreen, but follow the product label if it specifies a different routine. Stop or reduce use if the formula causes persistent irritation.';
    }

    if (/alpha arbutin|\barbutin\b|niacinamide|beta glucan|\bpdrn\b|peptide|ceramide|centella|\bcica\b|collagen/.test(text)) {
      return 'Apply as a leave-on skincare step after cleansing and lighter watery layers, then follow with moisturizer. If it is a serum or ampoule, it usually goes before cream; if it is already a cream, use it near the end of the routine. Follow the package for amount and frequency.';
    }

    if (category === 'Cleanser' || /cleanser|face wash|cleansing foam|creamy foam/.test(text)) {
      return 'Use as the cleansing step. Wet the face if the label directs, massage the cleanser gently over the skin without scrubbing, then rinse thoroughly and pat dry. Follow the package directions if it specifies a particular amount, contact time or frequency.';
    }

    if (category === 'Toner') {
      return 'After cleansing, apply a small amount with clean hands or a cotton pad, depending on the product directions. Let it settle, then continue with essence, serum and moisturizer. If it contains exfoliating or treatment actives, follow the label’s frequency rather than assuming it is for unlimited daily use.';
    }

    if (category === 'Essence') {
      return 'Apply after cleansing and toner, using a thin layer and gently pressing or smoothing it into the skin. Follow with serum or moisturizer. Use the amount and frequency recommended on the product label.';
    }

    if (category === 'Serum' || category === 'Ampoule') {
      return 'Apply a small, even layer after cleansing and toner/essence, then follow with moisturizer. When several serums are used together, layer from lighter to richer textures and follow any active-specific directions on the label.';
    }

    if (category === 'Moisturizer') {
      return 'Apply after lighter leave-on products to hydrate and help seal in moisture. Smooth an even layer over the face and neck as tolerated; in the morning, follow with sunscreen. Use more or less according to your skin needs and the product directions.';
    }

    if (category === 'Spot Treatment' || category === 'Acne Treatment') {
      return 'Apply only to the intended blemish or treatment area after cleansing, using a thin layer and following the active-specific package directions. Avoid the eyes, lips and broken skin unless the label specifically permits use there.';
    }

    if (category === 'Mist') {
      return 'Hold the bottle at the distance stated on the label and mist evenly over the face with eyes closed. Let it absorb or pat gently if directed. Use where it fits in the routine, but follow the label closely if the mist contains exfoliating or treatment actives.';
    }

    if (category === 'Facial Oil') {
      return 'Use a few drops as one of the final skincare steps, usually after water-based serums and either before or after moisturizer depending on the product directions. Press or smooth it gently over the skin rather than using a large amount.';
    }

    if (category === 'Primer') {
      return 'Apply a thin, even layer after skincare and sunscreen have settled, focusing on the areas where you want more grip, smoothing or finish control. Let it set briefly before foundation or other complexion makeup.';
    }

    if (['Foundation','Skin Tint / BB / CC','Concealer','Powder','Blush','Highlighter','Bronzer','Contour','Eyeshadow','Eyeliner','Mascara','Brows','Lipstick','Lip Tint','Lip Gloss','Lip Liner','Makeup Palette'].includes(category)) {
      return 'Apply as part of your makeup routine using the amount and tool that suit the formula. Follow the product label for any special setting, removal or safety directions, especially for products used close to the eyes or lips.';
    }

    if (category === 'Prescription / Dermatologist Treatment') {
      return 'Use exactly as your dermatologist or prescriber instructed. The amount, placement, timing and frequency can vary by medication and strength, so Ichigo should not replace those directions with a generic skincare schedule.';
    }

    return 'Use according to the product label, because the exact amount, placement and frequency can vary by formula. In Ichigo, keep the packaging or prescriber directions as the source of truth whenever they are more specific than this general routine guidance.';
  }

  function decorate() {
    const guide = document.getElementById('ichigoProductGuide');
    if (!guide) return;
    const product = currentProduct();
    if (!product) return;

    const whatHeading = [...guide.querySelectorAll('strong')].find(el => el.textContent.trim() === 'What it is');
    const whatBlock = whatHeading?.parentElement;
    if (!whatBlock) return;

    const text = howToUse(product);
    let block = guide.querySelector('[data-ichigo-how-to-use]');
    if (!block) {
      block = document.createElement('div');
      block.dataset.ichigoHowToUse = '1';
      block.style.marginTop = '16px';
      const title = document.createElement('strong');
      title.textContent = 'How to use';
      const paragraph = document.createElement('p');
      paragraph.style.marginTop = '5px';
      block.append(title, paragraph);
      whatBlock.insertAdjacentElement('afterend', block);
    }

    const paragraph = block.querySelector('p');
    if (paragraph && paragraph.textContent !== text) paragraph.textContent = text;
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
        decorate();
      });
    }).observe(sheet, { childList:true, subtree:true });
  }

  decorate();
})();
