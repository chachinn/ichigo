(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const BEAUTY_HOST = 'world.openbeautyfacts.org';
  const PRODUCTS_HOST = 'world.openproductsfacts.org';

  const normalize = value => String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[®™©]/g, ' ')
    .replace(/[‐‑–—]/g, '-')
    .replace(/[^a-zA-Z0-9%+\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  function buildVariants(raw) {
    const clean = normalize(raw);
    const variants = new Set([String(raw || '').trim(), clean]);

    // Common catalog noise often hurts exact product-name search.
    const withoutNoise = clean
      .replace(/\b(new|official|authentic|original|korea|korean|japan|japanese|skincare|skin care|makeup|cosmetic|cosmetics)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (withoutNoise) variants.add(withoutNoise);

    // A shorter query can recover products whose database title omits a long subtitle.
    const words = withoutNoise.split(' ').filter(Boolean);
    if (words.length > 7) variants.add(words.slice(0, 7).join(' '));
    if (words.length > 5) variants.add(words.slice(0, 5).join(' '));

    return [...variants].filter(Boolean).slice(0, 5);
  }

  function productKey(product) {
    const code = String(product?.code || '').trim();
    if (code) return `code:${code}`;
    const name = normalize(product?.product_name || product?.generic_name || '').toLowerCase();
    const brand = normalize(product?.brands || '').toLowerCase();
    return `text:${brand}|${name}`;
  }

  async function fetchJson(url, init) {
    const response = await nativeFetch(url, init);
    if (!response.ok) return { products: [] };
    try { return await response.json(); }
    catch (_) { return { products: [] }; }
  }

  async function mergedSearch(originalUrl, init) {
    const parsed = new URL(originalUrl, location.href);
    const rawQuery = parsed.searchParams.get('search_terms') || '';
    const variants = buildVariants(rawQuery);
    const pageSize = Math.min(20, Math.max(8, Number(parsed.searchParams.get('page_size')) || 12));
    const fields = parsed.searchParams.get('fields') || '';

    const requests = [];
    for (const query of variants) {
      for (const host of [BEAUTY_HOST, PRODUCTS_HOST]) {
        const url = new URL(parsed.href);
        url.hostname = host;
        url.searchParams.set('search_terms', query);
        url.searchParams.set('page_size', String(pageSize));
        if (fields) url.searchParams.set('fields', fields);
        requests.push(fetchJson(url.href, init));
      }
    }

    const settled = await Promise.allSettled(requests);
    const merged = new Map();
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      for (const product of result.value?.products || []) {
        if (!(product?.product_name || product?.generic_name)) continue;
        const key = productKey(product);
        const existing = merged.get(key);
        if (!existing) {
          merged.set(key, product);
          continue;
        }
        // Prefer the richer record if the same product appears in more than one project/query.
        const richness = item => [item?.image_front_url, item?.ingredients_text, item?.brands, item?.quantity, item?.categories]
          .filter(Boolean).length;
        if (richness(product) > richness(existing)) merged.set(key, product);
      }
    }

    const products = [...merged.values()].slice(0, Math.max(pageSize * 3, 24));
    return new Response(JSON.stringify({
      count: products.length,
      page: 1,
      page_size: products.length,
      products,
      ichigo_multi_source: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  window.fetch = function ichigoMultiSourceFetch(input, init) {
    try {
      const url = typeof input === 'string' ? input : input?.url;
      if (url) {
        const parsed = new URL(url, location.href);
        const isClassicSearch = parsed.pathname.includes('/cgi/search.pl');
        if (parsed.hostname === BEAUTY_HOST && isClassicSearch && parsed.searchParams.has('search_terms')) {
          return mergedSearch(parsed.href, init);
        }
      }
    } catch (error) {
      console.warn('Ichigo multi-source product search could not inspect this request.', error);
    }
    return nativeFetch(input, init);
  };

  window.IchigoOnlineSearchUpgrade = {
    version: '1.0.0',
    sources: [BEAUTY_HOST, PRODUCTS_HOST],
    buildVariants
  };
})();