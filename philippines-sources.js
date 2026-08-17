(() => {
  'use strict';
  const DATA_KEY='ichigo-v1-data';
  const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
  const google=q=>'https://www.google.com/search?q='+encodeURIComponent(q);
  const site=(domain,q)=>google(`site:${domain} "${q}"`);
  function product(){
    const sheet=document.getElementById('sheetContent');
    const title=sheet?.querySelector('.sheet-title h2')?.textContent?.trim();
    if(!sheet?.querySelector('#editProduct')||!title)return null;
    try{const db=JSON.parse(localStorage.getItem(DATA_KEY)||'{}');return db.products?.find(p=>norm(p.name)===norm(title))||null}catch{return null}
  }
  function add(){
    const panel=document.getElementById('ichigoWebMatchPanel');
    if(!panel||panel.querySelector('#ichigoPhSources'))return;
    const p=product(); if(!p)return;
    const q=[p.brand,p.name].filter(Boolean).join(' ').trim()||p.name;
    const text=norm([p.category,p.name,p.brand,...(p.tags||[])].filter(Boolean).join(' '));
    const perfume=/\b(perfume|parfum|fragrance|cologne|eau de|edp|edt|body mist)\b/.test(text);
    const wrap=document.createElement('div');
    wrap.id='ichigoPhSources';
    wrap.style.margin='14px 0 12px';
    const sources=[
      ['Watsons PH',site('watsons.com.ph',q)],
      ['Shopee Mall PH',google(`site:shopee.ph "${q}" "Official Store" OR Mall`)],
      ['LazMall PH',google(`site:lazada.com.ph "${q}" LazMall`)],
      ...(perfume?[['Fragrantica',site('fragrantica.com',q)]]:[])
    ];
    wrap.innerHTML=`<strong style="font-size:12px">🇵🇭 Philippines sources</strong><p style="font-size:10px;margin:4px 0 8px;color:var(--muted)">Useful for Philippine and locally sold products. Prefer Watsons, Mall/official stores, or the brand's official page when available.</p><div class="button-row">${sources.map((s,i)=>`<button class="secondary" type="button" data-ph-source="${i}">${s[0]}</button>`).join('')}</div>`;
    const card=panel.querySelector('.card');
    const firstButtons=card?.querySelector('.button-row');
    if(firstButtons) firstButtons.insertAdjacentElement('beforebegin',wrap); else card?.prepend(wrap);
    wrap.querySelectorAll('[data-ph-source]').forEach(b=>b.addEventListener('click',()=>window.open(sources[Number(b.dataset.phSource)][1],'_blank','noopener')));
  }
  const sheet=document.getElementById('sheetContent');
  if(sheet)new MutationObserver(()=>queueMicrotask(add)).observe(sheet,{childList:true,subtree:true});
  add();
})();