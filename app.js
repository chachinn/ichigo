(() => {
  'use strict';

  const BUILD = '1.0.0';
  const KEY = 'ichigo-v1-data';
  const SETTINGS_KEY = 'ichigo-v1-settings';

  const categories = [
    'First Cleanse','Cleanser','Toner','Essence','Serum','Ampoule','Moisturizer','Eye Care',
    'Spot Treatment','Sunscreen','Mist','Facial Oil','Exfoliant','Wash-Off Mask','Sheet Mask',
    'Sleeping Mask','Lip Care','Acne Treatment','Prescription / Dermatologist Treatment',
    'Primer','Foundation','Skin Tint / BB / CC','Concealer','Powder','Blush','Highlighter',
    'Bronzer','Contour','Setting Spray','Eyeshadow','Eyeliner','Mascara','Brows','Lipstick',
    'Lip Tint','Lip Gloss','Lip Liner','Makeup Palette','False Lashes','Tools / Devices',
    'Body Care','Hair / Scalp Care','Other'
  ];

  const statuses = [
    'Currently Using','Open','Unopened / Backup','Nearly Empty','Wishlist','Finished / Empty',
    'Expired','Decluttered','Gave Away','Returned','Travel Size','Sample','Archived'
  ];

  const knownBrands = [
    'COSRX','iUNIK','Numbuzin','SKIN1004','Centellian24','Seoul 1988','LION','Lion Japan',
    'Haruharu Wonder','House of Hur','Jumiso','ma:nyo','Medicube','Dr. Melaxin','Axis-Y',
    'Isntree','Garnier','Y.O.U.','Ishizawa Lab','Benzac','d’Alba','d\'Alba','Ckin',
    'Standard Seoul','Skin Correct'
  ];

  const ingredientRules = [
    ['Tretinoin', /\btretinoin\b/i],
    ['Retinal', /\bretinal\b/i],
    ['Retinol', /\bretinol\b/i],
    ['Benzoyl Peroxide', /\bbenzoyl peroxide\b|\bbenzoper\b/i],
    ['Azelaic Acid', /\bazelaic\b|\bazeloyl\b/i],
    ['Salicylic Acid / BHA', /\bsalicylic\b|\bbha\b/i],
    ['AHA', /\baha\b|\bglycolic\b|\blactic acid\b|\bmandelic\b/i],
    ['Vitamin C', /\bvitamin c\b|\bascorb/i],
    ['Niacinamide', /\bniacinamide\b|\bniacin\b/i],
    ['Alpha Arbutin', /\barbutin\b/i],
    ['PDRN', /\bpdrn\b/i],
    ['Peptides', /\bpeptide\b/i],
    ['Ceramides', /\bceramide\b/i],
    ['Beta-Glucan', /\bbeta[- ]?glucan\b/i],
    ['Tea Tree', /\btea tree\b/i],
    ['Collagen', /\bcollagen\b/i],
    ['YuJa', /\byuja\b/i],
  ];

  const categoryRules = [
    ['Sunscreen', /\bspf\b|\bsunscreen\b|\bsun screen\b|\bsunblock\b|\buv\b/i],
    ['Cleanser', /\bcleanser\b|\bcleansing foam\b|\bface wash\b|\bcleansing milk\b/i],
    ['First Cleanse', /\bcleansing oil\b|\bcleansing balm\b|\bmicellar\b/i],
    ['Toner', /\btoner\b/i],
    ['Essence', /\bessence\b/i],
    ['Ampoule', /\bampoule\b/i],
    ['Serum', /\bserum\b/i],
    ['Moisturizer', /\bcream\b|\bmoistur/i],
    ['Eye Care', /\beye cream\b|\beye serum\b/i],
    ['Lip Care', /\blip\b/i],
    ['Exfoliant', /\bexfoliat|\bscrub\b|\bpeel\b/i],
    ['Wash-Off Mask', /\bpack\b|\bwash.?off mask\b/i],
    ['Sheet Mask', /\bsheet mask\b/i],
    ['Mist', /\bmist\b|\bspray serum\b/i],
    ['Spot Treatment', /\bspot\b|\bacne cream\b/i],
    ['Primer', /\bprimer\b/i],
    ['Foundation', /\bfoundation\b/i],
    ['Concealer', /\bconcealer\b/i],
    ['Blush', /\bblush\b/i],
    ['Mascara', /\bmascara\b/i],
    ['Eyeliner', /\beyeliner\b/i],
    ['Lip Tint', /\blip tint\b|\btint\b/i],
    ['Lipstick', /\blipstick\b/i]
  ];

  const defaultData = () => ({
    products: [],
    diary: [],
    trash: [],
    routines: { AM: [], PM: [] },
    meta: { createdAt: Date.now(), build: BUILD }
  });

  let data = load();
  let route = 'home';
  let sheetState = null;
  let toastTimer = null;

  const $ = (q, root=document) => root.querySelector(q);
  const $$ = (q, root=document) => [...root.querySelectorAll(q)];
  const esc = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-'+Date.now()+'-'+Math.random().toString(16).slice(2));
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}) : '—';

  function load(){
    try{
      const parsed = JSON.parse(localStorage.getItem(KEY));
      return parsed && Array.isArray(parsed.products) ? parsed : defaultData();
    }catch(_){ return defaultData(); }
  }
  function save(){
    localStorage.setItem(KEY, JSON.stringify(data));
  }
  function settings(){
    try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { onlineSearch:true, cautious:'balanced' };}catch(_){return { onlineSearch:true, cautious:'balanced' };}
  }
  function saveSettings(s){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

  function toast(msg){
    const el = $('#toast'); el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(()=>el.classList.add('hidden'),2200);
  }

  function nav(to){
    route = to;
    $$('.nav-item[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === to));
    closeDrawer();
    render();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function inferBrand(name=''){
    const hit = knownBrands.find(b => name.toLowerCase().startsWith(b.toLowerCase()) || name.toLowerCase().includes(b.toLowerCase()));
    if(hit) return hit;
    const first = name.split(/\s+/).slice(0,2).join(' ');
    return first.length < 3 ? '' : first;
  }

  function inferCategory(name='', fallback='Other'){
    const hit = categoryRules.find(([,r]) => r.test(name));
    return hit ? hit[0] : fallback || 'Other';
  }

  function inferTags(text=''){
    return ingredientRules.filter(([,r])=>r.test(text)).map(([n])=>n);
  }

  function normalizeHeading(line=''){
    return line.replace(/\(\s*\d+\s*\)\s*$/,'').replace(/[:：]\s*$/,'').trim();
  }

  function headingCategory(line=''){
    const h = normalizeHeading(line).toLowerCase();
    const exact = {
      'cleanser':'Cleanser','cleansers':'Cleanser','toner/essence':'Toner','toner':'Toner','essence':'Essence',
      'serum':'Serum','serums':'Serum','ampoule':'Ampoule','moisturizer':'Moisturizer','moisturizers':'Moisturizer',
      'sunscreen':'Sunscreen','spot care':'Spot Treatment','eye care':'Eye Care','lip care':'Lip Care',
      'exfoliants':'Exfoliant','exfoliant':'Exfoliant','mask':'Wash-Off Mask','masks':'Wash-Off Mask',
      'mist':'Mist','mists':'Mist','derma prescribed medication / actives':'Prescription / Dermatologist Treatment',
      'derma prescribed medication/actives':'Prescription / Dermatologist Treatment','actives':'Prescription / Dermatologist Treatment'
    };
    return exact[h] || null;
  }

  function parseSmartImport(raw){
    const lines = raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    let status = 'Currently Using', cat = null, out = [];
    for(let line of lines){
      const clean = line.replace(/^[•·]\s*/,'').trim();
      const low = clean.toLowerCase();
      if(/^(sc\s*)?currently using\b/.test(low)){ status='Currently Using'; cat=null; continue; }
      if(/^(stocks?|backups?|unopened)\b/.test(low)){ status='Unopened / Backup'; cat=null; continue; }
      if(/^wish(list)?\b/.test(low)){ status='Wishlist'; cat=null; continue; }
      if(/^empt(ies|y)\b/.test(low)){ status='Finished / Empty'; cat=null; continue; }
      const hc = headingCategory(clean);
      if(hc){ cat=hc; continue; }
      const looksHeading = !/^[-–—]/.test(clean) && clean.length < 55 && /(\(\d+\))$/.test(clean);
      if(looksHeading){ cat = inferCategory(normalizeHeading(clean), cat || 'Other'); continue; }
      if(/^[-–—]/.test(clean)){
        let name = clean.replace(/^[-–—]\s*/,'').trim();
        if(!name) continue;
        const quantityMatch = name.match(/\((\d+)\)\s*$/);
        const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
        if(quantityMatch) name = name.replace(/\((\d+)\)\s*$/,'').trim();
        const category = inferCategory(name, cat || 'Other');
        const tags = inferTags(name);
        out.push({
          id:uid(), name, brand:inferBrand(name), category, status, quantity,
          remaining: status === 'Unopened / Backup' ? 100 : null,
          tags, notes:'', size:'', shade:'', price:'', currency:'PHP',
          purchaseDate:'', openedDate:'', expiryDate:'', pao:'',
          barcode:'', sourceUrl:'', sourceName:'', ingredients:'',
          image:'', createdAt:Date.now(), updatedAt:Date.now()
        });
      }
    }
    return out;
  }

  function productTemplate(p={}){
    return Object.assign({
      id:uid(), name:'', brand:'', category:'Other', status:'Currently Using', quantity:1,
      remaining:null,tags:[],notes:'',size:'',shade:'',price:'',currency:'PHP',purchaseDate:'',
      openedDate:'',expiryDate:'',pao:'',barcode:'',sourceUrl:'',sourceName:'',ingredients:'',
      image:'',createdAt:Date.now(),updatedAt:Date.now()
    }, p);
  }

  function stats(){
    const active = data.products.filter(p=>!['Archived','Finished / Empty','Expired','Decluttered','Gave Away','Returned'].includes(p.status));
    return {
      total:data.products.length,
      using:data.products.filter(p=>p.status==='Currently Using').length,
      backup:data.products.filter(p=>p.status==='Unopened / Backup').reduce((a,p)=>a+(Number(p.quantity)||1),0),
      wishlist:data.products.filter(p=>p.status==='Wishlist').length,
      expiring:data.products.filter(p=>daysToExpiry(p)>=0 && daysToExpiry(p)<=60).length,
      active:active.length
    };
  }
  function daysToExpiry(p){
    if(!p.expiryDate) return Infinity;
    const d = new Date(p.expiryDate); d.setHours(23,59,59,999);
    return Math.floor((d-Date.now())/86400000);
  }

  function render(){
    const main = $('#main');
    if(route==='home') main.innerHTML = homeView();
    else if(route==='stash') main.innerHTML = stashView();
    else if(route==='routine') main.innerHTML = routineView();
    else if(route==='diary') main.innerHTML = diaryView();
    else if(route==='wishlist') main.innerHTML = listView('Wishlist', p=>p.status==='Wishlist', '♡');
    else if(route==='empties') main.innerHTML = listView('Empties', p=>p.status==='Finished / Empty', '◌');
    else if(route==='ingredients') main.innerHTML = ingredientsView();
    else if(route==='analytics') main.innerHTML = analyticsView();
    else if(route==='trash') main.innerHTML = trashView();
    else if(route==='settings') main.innerHTML = settingsView();
    else if(route==='about') main.innerHTML = aboutView();
    bindView();
  }

  function homeView(){
    const s=stats();
    const due = data.products.filter(p=>daysToExpiry(p)>=0 && daysToExpiry(p)<=60).sort((a,b)=>daysToExpiry(a)-daysToExpiry(b)).slice(0,4);
    const recent = [...data.products].sort((a,b)=>b.createdAt-a.createdAt).slice(0,4);
    return `
      <section class="hero">
        <div><span class="eyebrow">Your beauty basket</span><h1>${s.total ? 'Hello, beauty collector.' : 'Start your Ichigo.'}</h1>
        <p>${s.total ? 'A calm little view of what you own, use, love, and want to finish.' : 'Add products one by one, search online, or paste your existing skincare list and let Smart Import sort it.'}</p></div>
        <div class="hero-berry">🍓</div>
      </section>

      <div class="card-grid">
        <article class="card stat-card"><div class="mini">▦ STASH</div><strong>${s.active}</strong><p>active products</p></article>
        <article class="card stat-card"><div class="mini">✦ USING</div><strong>${s.using}</strong><p>currently using</p></article>
        <article class="card stat-card"><div class="mini">○ BACKUPS</div><strong>${s.backup}</strong><p>unopened units</p></article>
        <article class="card stat-card"><div class="mini">♡ WISHLIST</div><strong>${s.wishlist}</strong><p>saved for later</p></article>
      </div>

      <section class="section">
        <div class="section-head"><h2>Quick actions</h2></div>
        <div class="quick-grid">
          <button class="quick" data-action="smart-search"><span>⌕</span><small>Smart Search</small></button>
          <button class="quick" data-action="manual-add"><span>＋</span><small>Manual Add</small></button>
          <button class="quick" data-action="open-import"><span>⇩</span><small>Smart Import</small></button>
          <button class="quick" data-action="add-diary"><span>♡</span><small>Skin Check</small></button>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Use me first</h2><button class="link-btn" data-nav="stash">View stash</button></div>
        ${due.length ? `<div class="product-list">${due.map(productCard).join('')}</div>` :
          `<div class="empty"><div class="empty-icon">⏳</div><h3>No expiry pressure</h3><p>Add expiry dates or PAO details and Ichigo will surface products that deserve attention first.</p></div>`}
      </section>

      <section class="section">
        <div class="section-head"><h2>Little shelf</h2><button class="link-btn" data-nav="stash">View all</button></div>
        ${recent.length ? `<div class="product-list">${recent.map(productCard).join('')}</div>` :
          `<div class="empty"><div class="empty-icon">🧴</div><h3>Your shelf is empty</h3><p>No demo products here. Your real collection starts when you add or import your first item.</p><div class="button-row" style="justify-content:center"><button class="primary" data-action="smart-search">Search online</button><button class="secondary" data-action="open-import">Import my list</button></div></div>`}
      </section>`;
  }

  function productCard(p){
    const img = p.image ? `<img src="${esc(p.image)}" alt="">` : '🧴';
    const exp = daysToExpiry(p);
    return `<article class="product-card" data-product="${p.id}">
      <div class="product-thumb">${img}</div>
      <div class="product-info">
        <h3>${esc(p.name || 'Untitled product')}</h3>
        <p>${esc(p.brand || 'Brand not set')} · ${esc(p.category)}</p>
        <div class="badges">
          <span class="badge">${esc(p.status)}</span>
          ${p.quantity>1?`<span class="badge gray">${p.quantity} units</span>`:''}
          ${exp!==Infinity && exp<=60?`<span class="badge green">${exp<0?'Expired':exp+'d left'}</span>`:''}
          ${p.sourceUrl?`<span class="badge lav">Online info</span>`:''}
        </div>
      </div>
      <button class="card-menu" data-product-menu="${p.id}" aria-label="Open product">›</button>
    </article>`;
  }

  function stashView(){
    return `<section class="section-head"><div><span class="eyebrow">Inventory</span><h1>My Stash</h1><p>Search, filter, sort, and manage skincare and makeup together.</p></div></section>
      <div class="searchbar"><input id="stashSearch" placeholder="Search product, brand, category, ingredient…"><button class="secondary" data-action="smart-search">Online</button></div>
      <div class="toolbar">
        <select id="statusFilter"><option value="">All statuses</option>${statuses.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
        <select id="categoryFilter"><option value="">All categories</option>${categories.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
        <select id="sortFilter"><option value="smart">Smart sort</option><option value="recent">Recently added</option><option value="name">A–Z</option><option value="expiry">Expiry first</option><option value="brand">Brand</option></select>
      </div>
      <div id="stashResults" class="product-list"></div>`;
  }

  function filteredStash(){
    const q=($('#stashSearch')?.value||'').toLowerCase(), sf=$('#statusFilter')?.value||'', cf=$('#categoryFilter')?.value||'', sort=$('#sortFilter')?.value||'smart';
    let arr=data.products.filter(p=>p.status!=='Archived' && (!q || [p.name,p.brand,p.category,p.status,p.ingredients,(p.tags||[]).join(' ')].join(' ').toLowerCase().includes(q)) && (!sf||p.status===sf) && (!cf||p.category===cf));
    if(sort==='name') arr.sort((a,b)=>a.name.localeCompare(b.name));
    if(sort==='brand') arr.sort((a,b)=>(a.brand||'').localeCompare(b.brand||''));
    if(sort==='recent') arr.sort((a,b)=>b.createdAt-a.createdAt);
    if(sort==='expiry') arr.sort((a,b)=>daysToExpiry(a)-daysToExpiry(b));
    if(sort==='smart'){
      const weight=p=>{
        const d=daysToExpiry(p);
        return (d<0?10000:d<=60?6000-d:0) + (p.status==='Nearly Empty'?3000:0)+(p.status==='Currently Using'?1800:0)+(p.status==='Open'?1000:0) - (p.status==='Unopened / Backup'?500:0);
      };
      arr.sort((a,b)=>weight(b)-weight(a)||b.updatedAt-a.updatedAt);
    }
    return arr;
  }

  function renderStashResults(){
    const el=$('#stashResults'); if(!el) return;
    const arr=filteredStash();
    el.innerHTML=arr.length?arr.map(productCard).join(''):`<div class="empty"><div class="empty-icon">⌕</div><h3>No products found</h3><p>Try another filter, search online, or add a new product.</p></div>`;
    bindProductOpen(el);
  }

  function routineView(){
    const am=data.routines.AM.map(id=>data.products.find(p=>p.id===id)).filter(Boolean);
    const pm=data.routines.PM.map(id=>data.products.find(p=>p.id===id)).filter(Boolean);
    return `<section class="section-head"><div><span class="eyebrow">Daily care</span><h1>Routine</h1><p>Keep your routines connected to the products you actually own.</p></div></section>
      ${routineBlock('AM','☀',am)}
      ${routineBlock('PM','☾',pm)}
      <button class="secondary" data-action="edit-routines">Edit routines</button>
      <div class="info-box" style="margin-top:14px">Ichigo can flag overlapping actives, but it will not override dermatologist instructions or treat ingredient pairings as universal medical rules.</div>`;
  }

  function routineBlock(name,icon,arr){
    return `<div class="routine-block"><h3>${icon} ${name} routine</h3>
      ${arr.length?arr.map((p,i)=>`<div class="routine-row"><div class="num">${i+1}</div><div class="grow"><strong>${esc(p.name)}</strong><small>${esc(p.category)} · ${esc((p.tags||[]).join(', ')||'No active tags')}</small></div><button class="link-btn" data-product-menu="${p.id}">›</button></div>`).join(''):
      `<div class="empty"><p>No products added yet.</p></div>`}
    </div>`;
  }

  function diaryView(){
    const entries=[...data.diary].sort((a,b)=>b.createdAt-a.createdAt);
    return `<section class="section-head"><div><span class="eyebrow">Skin history</span><h1>Diary</h1><p>Track what your skin was like and what you used—without claiming that one product caused a change.</p></div><button class="primary" data-action="add-diary">＋</button></section>
      ${entries.length?entries.map(e=>`<article class="diary-card"><div class="date">${fmtDate(e.date)}</div><h3>${esc(e.title||'Skin check-in')}</h3><div class="badges">${(e.concerns||[]).map(c=>`<span class="badge">${esc(c)}</span>`).join('')}</div><p style="margin-top:8px">${esc(e.notes||'No notes.')}</p></article>`).join(''):
      `<div class="empty"><div class="empty-icon">♡</div><h3>No diary entries yet</h3><p>Add a check-in whenever you want to remember what your skin was doing that day.</p><button class="primary" data-action="add-diary">Add check-in</button></div>`}`;
  }

  function listView(title, filter, icon){
    const arr=data.products.filter(filter);
    return `<section class="section-head"><div><span class="eyebrow">Collection</span><h1>${esc(title)}</h1><p>${title==='Wishlist'?'Things you want to try without mixing them into what you already own.':'Finished products stay useful as your personal beauty history.'}</p></div></section>
      ${arr.length?`<div class="product-list">${arr.map(productCard).join('')}</div>`:`<div class="empty"><div class="empty-icon">${icon}</div><h3>Nothing here yet</h3><p>This section will fill naturally as you use Ichigo.</p></div>`}`;
  }

  function ingredientsView(){
    const counts={};
    data.products.forEach(p=>(p.tags||[]).forEach(t=>counts[t]=(counts[t]||0)+1));
    const arr=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    return `<section class="section-head"><div><span class="eyebrow">Ingredient map</span><h1>Ingredients</h1><p>See which key actives appear repeatedly across your stash.</p></div></section>
      ${arr.length?`<div class="card metric-bars">${arr.map(([name,n])=>`<div class="metric-row"><span>${esc(name)}</span><div class="bar"><i style="width:${Math.min(100,n/Math.max(...arr.map(x=>x[1]))*100)}%"></i></div><strong>${n}</strong></div>`).join('')}</div>`:
      `<div class="empty"><div class="empty-icon">✦</div><h3>No ingredient tags yet</h3><p>Smart Search and Smart Import can detect common actives from product names and online information.</p></div>`}`;
  }

  function analyticsView(){
    const byCat={}; data.products.forEach(p=>byCat[p.category]=(byCat[p.category]||0)+(Number(p.quantity)||1));
    const arr=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const max=arr[0]?.[1]||1;
    const spend=data.products.reduce((s,p)=>s+(Number(p.price)||0)*(Number(p.quantity)||1),0);
    return `<section class="section-head"><div><span class="eyebrow">Your collection</span><h1>Analytics</h1><p>Useful inventory patterns without turning skincare into a scoreboard.</p></div></section>
      <div class="card-grid"><article class="card stat-card"><div class="mini">TOTAL ITEMS</div><strong>${data.products.length}</strong><p>product records</p></article><article class="card stat-card"><div class="mini">STASH VALUE</div><strong>₱${Math.round(spend).toLocaleString()}</strong><p>from prices you've entered</p></article></div>
      <section class="section"><div class="section-head"><h2>Top categories</h2></div>${arr.length?`<div class="card metric-bars">${arr.map(([c,n])=>`<div class="metric-row"><span>${esc(c)}</span><div class="bar"><i style="width:${n/max*100}%"></i></div><strong>${n}</strong></div>`).join('')}</div>`:`<div class="empty"><p>Add products to unlock inventory analytics.</p></div>`}</section>`;
  }

  function trashView(){
    return `<section class="section-head"><div><span class="eyebrow">Safety net</span><h1>Trash</h1><p>Deleted products are kept here until you permanently remove them.</p></div></section>
      ${data.trash.length?`<div class="product-list">${data.trash.map(p=>`<article class="product-card"><div class="product-thumb">${p.image?`<img src="${esc(p.image)}" alt="">`:'🧴'}</div><div class="product-info"><h3>${esc(p.name)}</h3><p>${esc(p.brand||'')} · deleted ${fmtDate(p.deletedAt)}</p></div><button class="secondary" data-restore="${p.id}">Restore</button></article>`).join('')}</div><button class="danger" style="margin-top:14px" data-action="empty-trash">Empty Trash</button>`:`<div class="empty"><div class="empty-icon">♲</div><h3>Trash is empty</h3><p>Deleted products will wait here instead of disappearing immediately.</p></div>`}`;
  }

  function settingsView(){
    const s=settings();
    return `<section class="section-head"><div><span class="eyebrow">Preferences</span><h1>Settings & Data</h1><p>Ichigo is local-first. Your inventory works offline; fresh online searches need a connection.</p></div></section>
      <div class="card">
        <div class="field"><label>Online Smart Search</label><select id="onlineSetting"><option value="on" ${s.onlineSearch?'selected':''}>On</option><option value="off" ${!s.onlineSearch?'selected':''}>Off</option></select></div>
        <div class="field"><label>Routine warning style</label><select id="cautiousSetting"><option value="relaxed" ${s.cautious==='relaxed'?'selected':''}>Relaxed</option><option value="balanced" ${s.cautious==='balanced'?'selected':''}>Balanced</option><option value="cautious" ${s.cautious==='cautious'?'selected':''}>Cautious</option></select></div>
      </div>
      <section class="section"><div class="section-head"><h2>Data</h2></div><div class="button-row"><button class="secondary" data-action="export-data">Export Backup</button><button class="secondary" data-action="import-backup">Import Backup</button></div></section>
      <div class="notice" style="margin-top:16px">Online product information can be incomplete or user-contributed. Ichigo keeps your own inventory data as the source of truth and asks you to review online matches before saving them.</div>`;
  }

  function aboutView(){
    return `<section class="section-head"><div><span class="eyebrow">ICHIGO · いちご</span><h1>About Ichigo</h1></div></section>
      <div class="card"><div style="font-size:50px">🍓</div><h3 style="font-family:Georgia,serif;color:var(--rose);font-size:25px;margin-bottom:8px">A basket of little beauty things.</h3><p>Ichigo means “strawberry” in Japanese. Like a basket filled with little strawberries, Ichigo is a place to gather all the small beauty things you love—from everyday skincare to favorite makeup and special finds.</p><hr class="soft"><p><strong>Version 1.0 · Build 1</strong><br>Local-first beauty inventory, Smart Import, online product lookup, routines, diary, wishlist, empties, ingredient tags, analytics, Trash, and backup tools.</p></div>`;
  }

  function bindView(){
    $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.nav)));
    $$('[data-action]').forEach(b=>b.addEventListener('click',()=>handleAction(b.dataset.action)));
    bindProductOpen(document);
    if(route==='stash'){
      ['stashSearch','statusFilter','categoryFilter','sortFilter'].forEach(id=>$('#'+id)?.addEventListener('input',renderStashResults));
      renderStashResults();
    }
    $$('[data-restore]').forEach(b=>b.addEventListener('click',()=>restoreTrash(b.dataset.restore)));
    $('#onlineSetting')?.addEventListener('change',e=>{const s=settings();s.onlineSearch=e.target.value==='on';saveSettings(s);toast('Setting saved');});
    $('#cautiousSetting')?.addEventListener('change',e=>{const s=settings();s.cautious=e.target.value;saveSettings(s);toast('Setting saved');});
  }

  function bindProductOpen(root){
    $$('[data-product-menu]',root).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openProduct(b.dataset.productMenu)}));
    $$('[data-product]',root).forEach(c=>c.addEventListener('click',()=>openProduct(c.dataset.product)));
  }

  function openDrawer(){
    $('#drawerBackdrop').classList.remove('hidden'); $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden','false');
  }
  function closeDrawer(){
    $('#drawerBackdrop').classList.add('hidden'); $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden','true');
  }
  function openSheet(html, state){
    sheetState=state; $('#sheetContent').innerHTML=html; $('#sheetBackdrop').classList.remove('hidden'); $('#sheet').classList.remove('hidden');
    $('#sheet').scrollTop=0;
  }
  function closeSheet(){
    sheetState=null; $('#sheetBackdrop').classList.add('hidden'); $('#sheet').classList.add('hidden'); $('#sheetContent').innerHTML='';
  }

  function handleAction(action){
    if(action==='smart-search') openSmartSearch();
    if(action==='manual-add') openProductEditor();
    if(action==='open-import') openSmartImport();
    if(action==='add-diary') openDiaryEditor();
    if(action==='edit-routines') openRoutineEditor();
    if(action==='empty-trash') { if(confirm('Permanently delete everything in Trash? This cannot be undone.')){data.trash=[];save();render();toast('Trash emptied');} }
    if(action==='export-data') exportData();
    if(action==='import-backup') importBackup();
  }

  function openQuickAdd(){
    openSheet(`<div class="sheet-title"><div><h2>Add to Ichigo</h2><p>Choose the fastest way to add your product.</p></div><button class="icon-button" data-close>×</button></div>
      <div class="card-grid">
        <button class="card" data-qa="smart" style="text-align:left"><div class="kicker">⌕ ONLINE</div><h3>Smart Search</h3><p>Find beauty products online, review the match, then save.</p></button>
        <button class="card" data-qa="manual" style="text-align:left"><div class="kicker">＋ MANUAL</div><h3>Manual Add</h3><p>Add only what you know now and complete it later.</p></button>
        <button class="card" data-qa="import" style="text-align:left"><div class="kicker">⇩ PASTE</div><h3>Smart Import</h3><p>Paste an existing list and let Ichigo sort it.</p></button>
        <button class="card" data-qa="wishlist" style="text-align:left"><div class="kicker">♡ LATER</div><h3>Wishlist</h3><p>Add something you want without mixing it into your stash.</p></button>
      </div>`,'quick');
    $$('[data-close]').forEach(b=>b.onclick=closeSheet);
    $$('[data-qa]').forEach(b=>b.onclick=()=>{const a=b.dataset.qa;closeSheet();if(a==='smart')openSmartSearch();if(a==='manual')openProductEditor();if(a==='import')openSmartImport();if(a==='wishlist')openProductEditor({status:'Wishlist'});});
  }

  function openSmartSearch(initial=''){
    openSheet(`<div class="sheet-title"><div><h2>Smart Search</h2><p>Search Open Beauty Facts, then review the product before adding it. If no structured result appears, open a normal web search.</p></div><button class="icon-button" data-close>×</button></div>
      <div class="searchbar"><input id="onlineQuery" value="${esc(initial)}" placeholder="e.g. LION Pair Acne Creamy Foam"><button class="primary" id="runOnlineSearch">Search</button></div>
      <div class="notice">Online results are reference information, not medical advice. Product formulas and packaging can change, so Ichigo keeps the source link and lets you edit every field.</div>
      <div id="onlineResults" style="margin-top:12px"></div>`,'smart-search');
    $('[data-close]').onclick=closeSheet;
    $('#runOnlineSearch').onclick=()=>searchOnline($('#onlineQuery').value);
    $('#onlineQuery').addEventListener('keydown',e=>{if(e.key==='Enter') searchOnline(e.target.value);});
    if(initial) searchOnline(initial);
  }

  async function searchOnline(q){
    q=q.trim(); if(!q) return toast('Enter a product name first');
    if(!settings().onlineSearch) return toast('Online Smart Search is turned off in Settings');
    const box=$('#onlineResults'); box.innerHTML='<div class="empty"><p>Searching the beauty database…</p></div>';
    const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),9000);
    try{
      const url='https://world.openbeautyfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(q)+'&search_simple=1&action=process&json=1&page_size=12';
      const res=await fetch(url,{signal:ctrl.signal,headers:{'Accept':'application/json'}});
      if(!res.ok) throw new Error('Search request failed');
      const json=await res.json();
      const products=(json.products||[]).filter(p=>p.product_name||p.generic_name).slice(0,12);
      if(!products.length) return renderOnlineFallback(q,'No structured match was found.');
      box.innerHTML=products.map((p,i)=>{
        const name=p.product_name||p.generic_name||'Unnamed product', brand=p.brands||'', image=p.image_front_small_url||p.image_front_url||'';
        return `<div class="result-card"><div>${image?`<img src="${esc(image)}" alt="">`:`<div class="product-thumb">🧴</div>`}</div><div><h4>${esc(name)}</h4><p>${esc(brand)}${p.quantity?' · '+esc(p.quantity):''}</p><div class="badges"><span class="badge lav">Open Beauty Facts</span>${p.code?`<span class="badge gray">${esc(p.code)}</span>`:''}</div><div class="button-row" style="margin-top:8px"><button class="primary" data-use-online="${i}">Use this</button>${p.code?`<button class="secondary" data-view-online="${i}">View source</button>`:''}</div></div></div>`;
      }).join('')+`<button class="link-btn" id="webFallback">Can't find it? Search the web instead →</button>`;
      $$('[data-use-online]').forEach(b=>b.onclick=()=>useOnline(products[Number(b.dataset.useOnline)]));
      $$('[data-view-online]').forEach(b=>b.onclick=()=>window.open('https://world.openbeautyfacts.org/product/'+encodeURIComponent(products[Number(b.dataset.viewOnline)].code),'_blank','noopener'));
      $('#webFallback').onclick=()=>renderOnlineFallback(q,'Open a broader web search.');
    }catch(err){
      renderOnlineFallback(q, err.name==='AbortError'?'The product database took too long to respond.':'The structured beauty database could not be reached from this connection.');
    }finally{clearTimeout(timer);}
  }

  function renderOnlineFallback(q,msg){
    const box=$('#onlineResults'); if(!box)return;
    const google='https://www.google.com/search?q='+encodeURIComponent(q+' skincare makeup product');
    const official='https://www.google.com/search?q='+encodeURIComponent(q+' official');
    box.innerHTML=`<div class="empty"><div class="empty-icon">🌐</div><h3>Search the wider web</h3><p>${esc(msg)} Ichigo can still open a normal internet search so you can verify the exact product and paste its source link into the product profile.</p><div class="button-row" style="justify-content:center"><button class="primary" id="openWeb">Search web</button><button class="secondary" id="openOfficial">Find official page</button></div></div>`;
    $('#openWeb').onclick=()=>window.open(google,'_blank','noopener');
    $('#openOfficial').onclick=()=>window.open(official,'_blank','noopener');
  }

  function useOnline(p){
    const code=p.code||'';
    const sourceUrl=code?'https://world.openbeautyfacts.org/product/'+code:'';
    const draft=productTemplate({
      name:p.product_name||p.generic_name||'',
      brand:p.brands||inferBrand(p.product_name||''),
      category:inferCategory([p.product_name,p.categories].filter(Boolean).join(' '),'Other'),
      size:p.quantity||'',
      barcode:code,
      image:p.image_front_url||p.image_front_small_url||'',
      ingredients:p.ingredients_text||p.ingredients_text_en||'',
      tags:inferTags([p.product_name,p.ingredients_text,p.ingredients_text_en].filter(Boolean).join(' ')),
      sourceUrl, sourceName:'Open Beauty Facts',
    });
    closeSheet();
    openProductEditor(draft,true);
  }

  function editorHtml(p, fromOnline=false){
    return `<div class="sheet-title"><div><h2>${p.id && data.products.some(x=>x.id===p.id)?'Edit Product':'Add Product'}</h2><p>${fromOnline?'Review the online match before saving. Your edits become your source of truth.':'Only the product name is required.'}</p></div><button class="icon-button" data-close>×</button></div>
      ${p.image?`<div class="product-thumb" style="width:92px;height:92px;margin-bottom:10px"><img src="${esc(p.image)}" alt=""></div>`:''}
      <div class="field"><label>Product name *</label><input id="fName" value="${esc(p.name)}" placeholder="Product name"></div>
      <div class="form-grid"><div class="field"><label>Brand</label><input id="fBrand" value="${esc(p.brand)}"></div><div class="field"><label>Category</label><select id="fCategory">${categories.map(c=>`<option ${p.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div></div>
      <div class="form-grid"><div class="field"><label>Status</label><select id="fStatus">${statuses.map(s=>`<option ${p.status===s?'selected':''}>${esc(s)}</option>`).join('')}</select></div><div class="field"><label>Quantity owned</label><input id="fQty" type="number" min="1" step="1" value="${Number(p.quantity)||1}"></div></div>
      <div class="form-grid"><div class="field"><label>Size</label><input id="fSize" value="${esc(p.size)}" placeholder="120 g"></div><div class="field"><label>Shade</label><input id="fShade" value="${esc(p.shade)}" placeholder="Optional"></div></div>
      <div class="form-grid"><div class="field"><label>Opened date</label><input id="fOpened" type="date" value="${esc(p.openedDate)}"></div><div class="field"><label>Expiry date</label><input id="fExpiry" type="date" value="${esc(p.expiryDate)}"></div></div>
      <div class="form-grid"><div class="field"><label>PAO</label><select id="fPao"><option value="">Unknown</option>${['3M','6M','9M','12M','18M','24M','36M'].map(x=>`<option ${p.pao===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Barcode</label><input id="fBarcode" value="${esc(p.barcode)}"></div></div>
      <div class="form-grid"><div class="field"><label>Price</label><input id="fPrice" type="number" min="0" step=".01" value="${esc(p.price)}"></div><div class="field"><label>Currency</label><select id="fCurrency">${['PHP','JPY','USD','KRW','SGD','HKD','EUR'].map(x=>`<option ${p.currency===x?'selected':''}>${x}</option>`).join('')}</select></div></div>
      <div class="field"><label>Key ingredient tags</label><input id="fTags" value="${esc((p.tags||[]).join(', '))}" placeholder="PDRN, Niacinamide, Retinal"></div>
      <div class="field"><label>Ingredients / INCI</label><textarea id="fIngredients" placeholder="Optional">${esc(p.ingredients)}</textarea></div>
      <div class="field"><label>Online source</label><input id="fSourceUrl" value="${esc(p.sourceUrl)}" placeholder="https://…"></div>
      <div class="field"><label>Notes</label><textarea id="fNotes" placeholder="Texture, irritation, repurchase thoughts…">${esc(p.notes)}</textarea></div>
      <div class="button-row"><button class="primary" id="saveProduct">Save Product</button>${p.id&&data.products.some(x=>x.id===p.id)?`<button class="danger" id="deleteProduct">Move to Trash</button>`:''}</div>`;
  }

  function openProductEditor(seed={}, fromOnline=false){
    const p=productTemplate(seed);
    openSheet(editorHtml(p,fromOnline),'editor');
    $('[data-close]').onclick=closeSheet;
    $('#saveProduct').onclick=()=>saveEditor(p);
    $('#deleteProduct')?.addEventListener('click',()=>deleteProduct(p.id));
  }

  function saveEditor(p){
    const name=$('#fName').value.trim(); if(!name) return toast('Product name is required');
    const updated=productTemplate({...p,
      name, brand:$('#fBrand').value.trim()||inferBrand(name), category:$('#fCategory').value,
      status:$('#fStatus').value, quantity:Math.max(1,Number($('#fQty').value)||1), size:$('#fSize').value.trim(),
      shade:$('#fShade').value.trim(), openedDate:$('#fOpened').value, expiryDate:$('#fExpiry').value,
      pao:$('#fPao').value, barcode:$('#fBarcode').value.trim(), price:$('#fPrice').value,
      currency:$('#fCurrency').value, tags:$('#fTags').value.split(',').map(x=>x.trim()).filter(Boolean),
      ingredients:$('#fIngredients').value.trim(), sourceUrl:$('#fSourceUrl').value.trim(),
      notes:$('#fNotes').value.trim(), updatedAt:Date.now()
    });
    const idx=data.products.findIndex(x=>x.id===p.id);
    if(idx>=0) data.products[idx]=updated; else data.products.push(updated);
    save(); closeSheet(); render(); toast(idx>=0?'Product updated':'Added to Ichigo');
  }

  function openProduct(id){
    const p=data.products.find(x=>x.id===id); if(!p)return;
    const exp=daysToExpiry(p);
    openSheet(`<div class="sheet-title"><div><span class="eyebrow">${esc(p.brand||'Beauty item')}</span><h2>${esc(p.name)}</h2><p>${esc(p.category)} · ${esc(p.status)}</p></div><button class="icon-button" data-close>×</button></div>
      ${p.image?`<div class="product-thumb" style="width:110px;height:110px"><img src="${esc(p.image)}" alt=""></div>`:''}
      <div class="badges" style="margin:12px 0">${(p.tags||[]).map(t=>`<span class="badge">${esc(t)}</span>`).join('')}${p.quantity>1?`<span class="badge gray">${p.quantity} units</span>`:''}${exp!==Infinity?`<span class="badge green">${exp<0?'Expired':exp+' days to expiry'}</span>`:''}</div>
      <div class="card"><p><strong>Size:</strong> ${esc(p.size||'—')}<br><strong>Opened:</strong> ${fmtDate(p.openedDate)}<br><strong>Expiry:</strong> ${fmtDate(p.expiryDate)}<br><strong>PAO:</strong> ${esc(p.pao||'—')}<br><strong>Barcode:</strong> ${esc(p.barcode||'—')}</p></div>
      ${p.ingredients?`<section class="section"><div class="section-head"><h2>Ingredients</h2></div><div class="card"><p>${esc(p.ingredients)}</p></div></section>`:''}
      ${p.notes?`<section class="section"><div class="section-head"><h2>Notes</h2></div><div class="card"><p>${esc(p.notes)}</p></div></section>`:''}
      <div class="button-row" style="margin-top:16px"><button class="primary" id="editProduct">Edit</button><button class="secondary" id="usedToday">Used today</button>${p.sourceUrl?`<button class="secondary" id="viewSource">View online</button>`:`<button class="secondary" id="findOnline">Find online</button>`}</div>`,'detail');
    $('[data-close]').onclick=closeSheet;
    $('#editProduct').onclick=()=>{closeSheet();openProductEditor(p);};
    $('#usedToday').onclick=()=>{p.lastUsed=Date.now();p.useCount=(p.useCount||0)+1;p.updatedAt=Date.now();save();toast('Usage recorded');};
    $('#viewSource')?.addEventListener('click',()=>window.open(p.sourceUrl,'_blank','noopener'));
    $('#findOnline')?.addEventListener('click',()=>{const q=p.name;closeSheet();openSmartSearch(q);});
  }

  function deleteProduct(id){
    const idx=data.products.findIndex(p=>p.id===id); if(idx<0)return;
    if(!confirm('Move this product to Trash?')) return;
    const [p]=data.products.splice(idx,1); p.deletedAt=Date.now(); data.trash.unshift(p);
    data.routines.AM=data.routines.AM.filter(x=>x!==id);data.routines.PM=data.routines.PM.filter(x=>x!==id);
    save();closeSheet();render();toast('Moved to Trash');
  }
  function restoreTrash(id){
    const idx=data.trash.findIndex(p=>p.id===id);if(idx<0)return;
    const [p]=data.trash.splice(idx,1);delete p.deletedAt;p.updatedAt=Date.now();data.products.push(p);save();render();toast('Product restored');
  }

  function openSmartImport(){
    openSheet(`<div class="sheet-title"><div><h2>Smart Import</h2><p>Paste a Notes-style list. Ichigo recognizes sections such as Currently Using, Stocks, Cleanser, Toner/Essence, Serum, and prescribed actives.</p></div><button class="icon-button" data-close>×</button></div>
      <div class="field"><label>Paste your list</label><textarea id="importText" style="min-height:180px" placeholder="SC Currently Using&#10;&#10;Cleanser&#10;-Product name&#10;&#10;Stocks&#10;&#10;Serum (3)&#10;-Another product"></textarea></div>
      <div class="button-row"><button class="primary" id="previewImport">Preview Smart Sort</button><button class="secondary" id="clearImport">Clear</button></div>
      <div id="importPreview" style="margin-top:14px"></div>`,'import');
    $('[data-close]').onclick=closeSheet;
    $('#clearImport').onclick=()=>{$('#importText').value='';$('#importPreview').innerHTML='';};
    $('#previewImport').onclick=()=>{
      const parsed=parseSmartImport($('#importText').value);
      const box=$('#importPreview');
      if(!parsed.length){box.innerHTML='<div class="notice">No product lines were detected. Product lines should usually start with a hyphen.</div>';return;}
      const dupes=parsed.filter((p,i)=>parsed.findIndex(x=>x.name.toLowerCase()===p.name.toLowerCase())!==i);
      box.innerHTML=`<div class="info-box">Detected <strong>${parsed.length}</strong> product lines${dupes.length?` and <strong>${dupes.length}</strong> possible duplicate line(s)`:''}. Review the preview before importing.</div>
        <div class="import-preview" style="margin-top:9px">${parsed.map(p=>`<div class="import-row"><div><strong>${esc(p.name)}</strong><small>${esc(p.brand)} · ${esc(p.category)} · ${esc(p.status)}</small></div><span class="badge">${p.quantity}×</span></div>`).join('')}</div>
        <button class="primary" id="confirmImport" style="margin-top:11px">Import ${parsed.length} products</button>`;
      $('#confirmImport').onclick=()=>{
        const existing=new Map(data.products.map(p=>[p.name.trim().toLowerCase(),p]));
        let added=0, merged=0;
        parsed.forEach(p=>{
          const key=p.name.trim().toLowerCase();
          if(existing.has(key) && p.status==='Unopened / Backup'){
            const ex=existing.get(key);ex.quantity=(Number(ex.quantity)||1)+(Number(p.quantity)||1);ex.updatedAt=Date.now();merged++;
          }else{data.products.push(p);existing.set(key,p);added++;}
        });
        save();closeSheet();render();toast(`Imported ${added} · merged ${merged} backup match${merged===1?'':'es'}`);
      };
    };
  }

  function openRoutineEditor(){
    const eligible=data.products.filter(p=>!['Wishlist','Finished / Empty','Expired','Archived','Decluttered','Gave Away','Returned'].includes(p.status));
    openSheet(`<div class="sheet-title"><div><h2>Edit Routines</h2><p>Select products for AM and PM. Order follows the category-aware smart order when saved.</p></div><button class="icon-button" data-close>×</button></div>
      <div class="segment"><button class="active" data-routine-tab="AM">☀ AM</button><button data-routine-tab="PM">☾ PM</button></div><div id="routinePick"></div>`,'routine-edit');
    $('[data-close]').onclick=closeSheet;
    let tab='AM';
    const rank=c=>{const order=['First Cleanse','Cleanser','Toner','Essence','Serum','Ampoule','Eye Care','Spot Treatment','Acne Treatment','Prescription / Dermatologist Treatment','Moisturizer','Facial Oil','Sunscreen'];const i=order.indexOf(c);return i<0?99:i;};
    function draw(){
      const selected=new Set(data.routines[tab]);
      $('#routinePick').innerHTML=eligible.length?eligible.sort((a,b)=>rank(a.category)-rank(b.category)).map(p=>`<label class="routine-row"><input type="checkbox" data-routine-product="${p.id}" ${selected.has(p.id)?'checked':''}><div class="grow"><strong>${esc(p.name)}</strong><small>${esc(p.category)}</small></div></label>`).join(''):`<div class="empty"><p>Add products to your stash first.</p></div>`;
      $$('[data-routine-product]').forEach(cb=>cb.onchange=()=>{
        const id=cb.dataset.routineProduct; const list=data.routines[tab];
        if(cb.checked&&!list.includes(id))list.push(id);if(!cb.checked)data.routines[tab]=list.filter(x=>x!==id);
        data.routines[tab].sort((a,b)=>rank(data.products.find(p=>p.id===a)?.category)-rank(data.products.find(p=>p.id===b)?.category));
        save();
      });
    }
    $$('[data-routine-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.routineTab;$$('[data-routine-tab]').forEach(x=>x.classList.toggle('active',x===b));draw();});
    draw();
  }

  function openDiaryEditor(){
    openSheet(`<div class="sheet-title"><div><h2>Skin Check-In</h2><p>Keep it quick or add detail. Everything is optional except the date.</p></div><button class="icon-button" data-close>×</button></div>
      <div class="field"><label>Date</label><input id="dDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="field"><label>Title</label><input id="dTitle" placeholder="e.g. Calm skin, breakout day, post-travel"></div>
      <div class="field"><label>Concerns (comma-separated)</label><input id="dConcerns" placeholder="Redness, Dryness, Breakouts"></div>
      <div class="field"><label>Notes</label><textarea id="dNotes" placeholder="What did your skin feel like today?"></textarea></div>
      <button class="primary" id="saveDiary">Save Check-In</button>`,'diary-edit');
    $('[data-close]').onclick=closeSheet;
    $('#saveDiary').onclick=()=>{
      data.diary.push({id:uid(),date:$('#dDate').value,title:$('#dTitle').value.trim(),concerns:$('#dConcerns').value.split(',').map(x=>x.trim()).filter(Boolean),notes:$('#dNotes').value.trim(),createdAt:Date.now()});
      save();closeSheet();nav('diary');toast('Check-in saved');
    };
  }

  function exportData(){
    const blob=new Blob([JSON.stringify({app:'Ichigo',version:BUILD,exportedAt:new Date().toISOString(),data},null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ichigo-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function importBackup(){
    const input=document.createElement('input');input.type='file';input.accept='application/json';
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;
      try{
        const j=JSON.parse(await file.text());const next=j.data||j;
        if(!next||!Array.isArray(next.products)||!Array.isArray(next.diary)||!Array.isArray(next.trash))throw new Error();
        if(!confirm(`Replace current Ichigo data with this backup containing ${next.products.length} products? Export your current data first if needed.`))return;
        data=next;save();render();toast('Backup restored');
      }catch(_){alert('This does not look like a valid Ichigo backup. Nothing was changed.');}
    };input.click();
  }

  // Global bindings
  $('#menuBtn').addEventListener('click',openDrawer);
  $('#closeDrawerBtn').addEventListener('click',closeDrawer);
  $('#drawerBackdrop').addEventListener('click',closeDrawer);
  $('#sheetBackdrop').addEventListener('click',closeSheet);
  $('#quickAddBtn').addEventListener('click',openQuickAdd);
  $('#globalSearchBtn').addEventListener('click',()=>{nav('stash');setTimeout(()=>$('#stashSearch')?.focus(),50);});
  $$('.drawer [data-nav]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.nav)));
  $$('.drawer [data-action]').forEach(b=>b.addEventListener('click',()=>{closeDrawer();handleAction(b.dataset.action);}));

  // Prevent accidental zoom gestures on iOS while keeping normal scrolling.
  document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
  let lastTouchEnd=0;
  document.addEventListener('touchend',e=>{const now=Date.now();if(now-lastTouchEnd<=300)e.preventDefault();lastTouchEnd=now;},{passive:false});

  // Register service worker only on http(s), never file://.
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
  }

  render();
})();
