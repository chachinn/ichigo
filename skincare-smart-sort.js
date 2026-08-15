(() => {
  'use strict';

  const DATA_KEY = 'ichigo-v1-data';
  const MEMORY_KEY = 'ichigo-skincare-sort-memory-v1';
  const BACKUP_KEY = 'ichigo-skincare-sort-backup-v1';
  const CATEGORIES = [
    'First Cleanse','Cleanser','Toner','Essence','Serum','Ampoule','Moisturizer','Eye Care',
    'Spot Treatment','Sunscreen','Mist','Facial Oil','Exfoliant','Wash-Off Mask','Sheet Mask',
    'Sleeping Mask','Lip Care','Acne Treatment','Prescription / Dermatologist Treatment'
  ];
  const CATEGORY_SET = new Set(CATEGORIES);

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const norm = value => String(value || '').toLowerCase().normalize('NFKD')
    .replace(/\b\d+(?:\.\d+)?\s*(?:ml|l|g|kg|mg|oz|fl\s*oz|pcs?|pieces?|packs?|count|ct)\b/g,' ')
    .replace(/[^a-z0-9%+.-]+/g,' ').replace(/\s+/g,' ').trim();

  function readData(){
    try{
      const data=JSON.parse(localStorage.getItem(DATA_KEY)||'{}');
      return data&&Array.isArray(data.products)?data:{products:[],diary:[],trash:[],routines:{AM:[],PM:[]},meta:{}};
    }catch(_){return {products:[],diary:[],trash:[],routines:{AM:[],PM:[]},meta:{}};}
  }
  function writeData(data){localStorage.setItem(DATA_KEY,JSON.stringify(data));}
  function readMemory(){
    try{const value=JSON.parse(localStorage.getItem(MEMORY_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch(_){return {};}
  }
  function saveMemory(value){localStorage.setItem(MEMORY_KEY,JSON.stringify(value));}
  function uid(){return globalThis.crypto?.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(16).slice(2);}

  function memoryTokens(key){
    const ignored=new Set(['the','and','for','with','from','skin','skincare','face','facial','new','mini','travel','size','cream','serum']);
    return String(key||'').split(/\s+/).filter(token=>token.length>2&&!ignored.has(token));
  }
  function rememberedCategory(name){
    const key=norm(name);if(!key)return '';
    const memory=readMemory(),direct=memory[key];
    if(direct&&CATEGORY_SET.has(direct.category||direct))return direct.category||direct;
    const tokens=memoryTokens(key);if(tokens.length<2)return '';
    let best='',bestScore=0,bestUpdated=0;
    Object.entries(memory).forEach(([learnedKey,entry])=>{
      const category=typeof entry==='string'?entry:String(entry?.category||'');if(!CATEGORY_SET.has(category))return;
      const learned=memoryTokens(learnedKey);if(!learned.length)return;
      const overlap=tokens.filter(token=>learned.includes(token)).length;
      const score=overlap/Math.max(tokens.length,learned.length),updated=Number(entry?.updatedAt||0);
      if(overlap>=2&&(score>bestScore||(score===bestScore&&updated>bestUpdated))){best=category;bestScore=score;bestUpdated=updated;}
    });
    return bestScore>=.55?best:'';
  }
  function rememberCategory(name,category){
    const key=norm(name),clean=String(category||'').trim();if(!key||!CATEGORY_SET.has(clean))return;
    const memory=readMemory();memory[key]={category:clean,updatedAt:Date.now()};
    const entries=Object.entries(memory);if(entries.length>300){entries.sort((a,b)=>Number(a[1]?.updatedAt||0)-Number(b[1]?.updatedAt||0));entries.slice(0,entries.length-300).forEach(([oldKey])=>delete memory[oldKey]);}
    saveMemory(memory);
  }

  function builtInCategory(name,hint=''){
    const value=norm(name),heading=String(hint||'').trim();if(!value)return CATEGORY_SET.has(heading)?heading:'';
    if(/\b(tretinoin|adapalene|clindamycin|hydroquinone|prescription|rx)\b/.test(value))return 'Prescription / Dermatologist Treatment';
    if(/\b(micellar|cleansing oil|cleansing balm|makeup remover|cleansing butter|cleansing sherbet)\b/.test(value))return 'First Cleanse';
    if(/\b(face wash|facial wash|cleanser|cleansing foam|creamy foam|foaming wash|gel wash|enzyme wash|soap bar)\b/.test(value))return 'Cleanser';
    if(/\b(sheet mask|sheetmask|mask sheet|hydrogel mask)\b/.test(value))return 'Sheet Mask';
    if(/\b(sleeping mask|sleep mask|overnight mask)\b/.test(value))return 'Sleeping Mask';
    if(/\b(wash off mask|wash-off mask|rice pack|clay mask|mud mask|modeling mask|peel off mask|peel-off mask)\b/.test(value))return 'Wash-Off Mask';
    if(/\b(spf\s*\d+|sunscreen|sun screen|sunblock|sun block|uv protector|uv protection|sun essence|sun serum|sun cream|sun stick)\b/.test(value))return 'Sunscreen';
    if(/\b(eye cream|eye serum|eye gel|eye balm|under eye|under-eye)\b/.test(value))return 'Eye Care';
    if(/\b(lip balm|lip mask|lip treatment|lip scrub|lip care)\b/.test(value))return 'Lip Care';
    if(/\b(exfoliating toner|acid toner|peeling toner|peel pad|peeling pad|exfoliant|exfoliator|peeling gel|aha bha|aha\s*\d|bha\s*\d|glycolic acid|lactic acid|mandelic acid)\b/.test(value))return 'Exfoliant';
    if(/\b(spot treatment|spot cream|acne cream|pimple cream|blemish cream|acne gel|pimple gel)\b/.test(value))return 'Spot Treatment';
    if(/\b(benzoyl peroxide|azelaic acid|acne treatment)\b/.test(value)&&!/\bserum|ampoule|toner|cream cleanser|wash|foam\b/.test(value))return 'Acne Treatment';
    if(/\b(mist|face spray|facial spray|spray serum)\b/.test(value))return 'Mist';
    if(/\b(toner|skin toner|toning water)\b/.test(value))return 'Toner';
    if(/\bessence\b/.test(value))return 'Essence';
    if(/\bampoule\b/.test(value))return 'Ampoule';
    if(/\bserum\b/.test(value))return 'Serum';
    if(/\b(face oil|facial oil|squalane oil|rosehip oil)\b/.test(value))return 'Facial Oil';
    if(/\b(moisturizer|moisturiser|gel cream|water cream|barrier cream|face cream|facial cream|emulsion|lotion|cream)\b/.test(value))return 'Moisturizer';
    return CATEGORY_SET.has(heading)?heading:'';
  }
  function smartCategory(name,hint=''){return rememberedCategory(name)||builtInCategory(name,hint)||(CATEGORY_SET.has(hint)?hint:'');}
  function isSkincareProduct(product){return CATEGORY_SET.has(String(product?.category||''))||Boolean(smartCategory(product?.name||''));}

  function inferTags(text){
    const rules=[['Tretinoin',/\btretinoin\b/i],['Retinal',/\bretinal\b/i],['Retinol',/\bretinol\b/i],['Benzoyl Peroxide',/\bbenzoyl peroxide\b/i],['Azelaic Acid',/\bazelaic\b/i],['Salicylic Acid / BHA',/\bsalicylic\b|\bbha\b/i],['AHA',/\baha\b|\bglycolic\b|\blactic acid\b|\bmandelic\b/i],['Vitamin C',/\bvitamin c\b|\bascorb/i],['Niacinamide',/\bniacinamide\b/i],['Alpha Arbutin',/\barbutin\b/i],['PDRN',/\bpdrn\b/i],['Peptides',/\bpeptide\b/i],['Ceramides',/\bceramide\b/i],['Beta-Glucan',/\bbeta[- ]?glucan\b/i],['Tea Tree',/\btea tree\b/i],['Collagen',/\bcollagen\b/i]];
    return rules.filter(([,pattern])=>pattern.test(String(text||''))).map(([label])=>label);
  }
  function inferBrand(name){
    const known=['COSRX','iUNIK','Numbuzin','SKIN1004','Centellian24','Seoul 1988','LION','Lion Japan','Haruharu Wonder','House of Hur','Jumiso','ma:nyo','Medicube','Dr. Melaxin','Axis-Y','Isntree','Garnier','Y.O.U.','Ishizawa Lab','Benzac','d’Alba','Standard Seoul','Skin Correct'];
    const lower=String(name||'').toLowerCase();return known.find(brand=>lower.startsWith(brand.toLowerCase())||lower.includes(brand.toLowerCase()))||'';
  }

  function headingCategory(line){
    const clean=String(line||'').replace(/[():：\d]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
    const map=[[/first cleanse|makeup remover|micellar|cleansing oil|cleansing balm/,'First Cleanse'],[/cleanser|cleansers|face wash/,'Cleanser'],[/toner/,'Toner'],[/essence/,'Essence'],[/serum/,'Serum'],[/ampoule/,'Ampoule'],[/moistur|cream/,'Moisturizer'],[/eye care|eye cream|eye serum/,'Eye Care'],[/spot care|spot treatment/,'Spot Treatment'],[/sunscreen|sun care|spf/,'Sunscreen'],[/mist/,'Mist'],[/facial oil|face oil/,'Facial Oil'],[/exfoliant|exfoliation|acid/,'Exfoliant'],[/wash off mask|wash-off mask|pack/,'Wash-Off Mask'],[/sheet mask/,'Sheet Mask'],[/sleeping mask/,'Sleeping Mask'],[/lip care/,'Lip Care'],[/acne treatment/,'Acne Treatment'],[/prescription|derma|medication|actives/,'Prescription / Dermatologist Treatment']];
    return map.find(([pattern])=>pattern.test(clean))?.[1]||'';
  }
  function statusHeading(line){
    const value=norm(line);if(/^(sc )?currently using\b/.test(value))return 'Currently Using';if(/^(stocks?|backups?|unopened)\b/.test(value))return 'Unopened / Backup';if(/^wish(list)?\b/.test(value))return 'Wishlist';if(/^empt(ies|y|finished)\b/.test(value))return 'Finished / Empty';return '';
  }
  function parseSkincareText(raw){
    const lines=String(raw||'').replace(/\r/g,'').split('\n').map(line=>line.trim()).filter(Boolean);let currentStatus='Currently Using',currentCategory='';const items=[];
    lines.forEach(rawLine=>{
      const bullet=/^[-–—•·*▪◦‣]\s*/.test(rawLine);let line=rawLine.replace(/^[-–—•·*▪◦‣]\s*/,'').trim();if(!line)return;
      const status=statusHeading(line);if(status){currentStatus=status;currentCategory='';return;}
      const heading=headingCategory(line),headingish=!bullet&&(heading||/\(\s*\d+\s*\)\s*$/.test(line)||/:$/.test(line));if(headingish&&heading){currentCategory=heading;return;}
      const quantityMatch=line.match(/\((\d+)\)\s*$/),quantity=quantityMatch?Math.max(1,Number(quantityMatch[1])||1):1;if(quantityMatch)line=line.replace(/\((\d+)\)\s*$/,'').trim();
      const category=smartCategory(line,currentCategory);if(!category&&!bullet&&!currentCategory)return;if(!line||line.length<2)return;
      items.push({name:line,category:category||currentCategory||'Other',status:currentStatus,quantity,confidence:rememberedCategory(line)?'Learned':category?'High':'Review'});
    });
    return items;
  }

  function ensureStyles(){
    if(document.getElementById('ichigoSkincareSortStyles'))return;const style=document.createElement('style');style.id='ichigoSkincareSortStyles';style.textContent=`.smart-sort-modal{position:fixed;inset:0;z-index:90;background:rgba(35,24,29,.38);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center}.smart-sort-panel{width:min(100%,720px);max-height:92dvh;overflow:auto;background:var(--cream-2);border-radius:28px 28px 0 0;padding:14px 16px calc(24px + var(--safe-bottom));box-shadow:0 -20px 55px rgba(60,30,40,.2)}.smart-sort-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.smart-sort-head h2{margin:3px 0 5px}.smart-sort-head p{margin:0;color:var(--muted);font-size:12px;line-height:1.45}.smart-sort-preview{display:grid;gap:9px;margin-top:14px}.smart-sort-row{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:flex-start;background:white;border:1px solid var(--line);border-radius:18px;padding:11px}.smart-sort-row select{width:100%;border:1px solid var(--line);border-radius:12px;padding:9px;background:white;color:var(--ink);font-size:11px}.smart-sort-row strong{display:block;font-size:12px;margin-bottom:5px}.smart-sort-row small{display:block;color:var(--muted);font-size:9px;margin-top:5px}.smart-sort-row .duplicate{color:#9a6a1d}.smart-sort-row input[type=checkbox]{margin-top:4px;width:18px;height:18px}.smart-sort-note{margin-top:10px;padding:11px;border-radius:15px;background:#fff5df;border:1px solid #eedfb9;color:#735f31;font-size:10px;line-height:1.45}`;document.head.appendChild(style);
  }

  function enhanceProductEditor(){
    const nameInput=document.getElementById('fName'),category=document.getElementById('fCategory');if(!nameInput||!category||nameInput.dataset.skincareSortBound==='1')return;nameInput.dataset.skincareSortBound='1';
    const field=category.closest('.field');let hint=field?.querySelector('[data-skincare-smart-hint]');if(!hint&&field){hint=document.createElement('small');hint.dataset.skincareSmartHint='1';hint.style.cssText='color:var(--rose);font-size:9px;line-height:1.35';field.appendChild(hint);}
    const apply=()=>{const name=nameInput.value.trim();if(!name){if(hint)hint.textContent='';return;}const suggested=smartCategory(name),canApply=!category.value||category.value==='Other'||category.dataset.skincareSmartApplied==='1';if(suggested&&canApply){category.value=suggested;category.dataset.skincareSmartApplied='1';if(hint)hint.textContent=`✨ Smart sorted to ${suggested}. Change it and Ichigo will remember.`;}else if(hint&&suggested&&category.value===suggested)hint.textContent=`✨ ${suggested}`;else if(hint)hint.textContent='';};
    nameInput.addEventListener('input',apply);category.addEventListener('change',event=>{if(!event.isTrusted)return;delete category.dataset.skincareSmartApplied;const name=nameInput.value.trim();if(name&&CATEGORY_SET.has(category.value)){rememberCategory(name,category.value);if(hint)hint.textContent=`✓ Remembered: ${category.value} for this product.`;}else if(hint)hint.textContent='';});apply();
  }

  function openModal(){
    closeModal();ensureStyles();const overlay=document.createElement('div');overlay.id='ichigoSkincareSmartSortModal';overlay.className='smart-sort-modal';overlay.innerHTML=`<div class="smart-sort-panel"><div class="smart-sort-head"><div><span class="eyebrow">Skincare smart sort</span><h2>Paste your skincare</h2><p>Paste a Notes-style list or one product per line. Ichigo detects status headings, product type, quantities, and learns from category corrections.</p></div><button class="icon-button" type="button" data-smart-sort-close>×</button></div><div class="field"><label>Skincare list</label><textarea id="ichigoSkincareSortText" style="min-height:180px" placeholder="Currently Using\nCleanser\n- LION Pair Acne Creamy Foam\nSerum\n- iUNIK Tea Tree Relief Serum\n\nStocks\nSunscreen\n- Haruharu Wonder Airyfit SPF50+"></textarea></div><div class="button-row"><button class="primary" type="button" data-smart-sort-preview>Preview Smart Sort</button><button class="secondary" type="button" data-smart-sort-close>Cancel</button></div><div id="ichigoSkincareSortPreview"></div></div>`;document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-smart-sort-close]').forEach(button=>button.addEventListener('click',closeModal));overlay.addEventListener('click',event=>{if(event.target===overlay)closeModal();});overlay.querySelector('[data-smart-sort-preview]')?.addEventListener('click',preview);requestAnimationFrame(()=>overlay.querySelector('textarea')?.focus());
  }
  function closeModal(){document.getElementById('ichigoSkincareSmartSortModal')?.remove();}
  function preview(){
    const parsed=parseSkincareText(document.getElementById('ichigoSkincareSortText')?.value||''),previewEl=document.getElementById('ichigoSkincareSortPreview');if(!previewEl)return;if(!parsed.length){previewEl.innerHTML='<div class="smart-sort-note">I couldn’t find skincare products yet. Try one product per line, or use headings such as Cleanser, Toner, Serum, Sunscreen, Currently Using, or Stocks.</div>';return;}
    const existing=readData().products;previewEl.innerHTML=`<div class="smart-sort-note">Review before saving. Exact-name matches already in your Stash are flagged and left unchecked so Ichigo never silently merges duplicates.</div><div class="smart-sort-preview">${parsed.map((item,index)=>{const duplicate=existing.some(product=>norm(product.name)===norm(item.name));return `<label class="smart-sort-row"><input type="checkbox" data-smart-sort-select="${index}" ${duplicate?'':'checked'}><div><strong>${esc(item.name)}</strong><select data-smart-sort-category="${index}">${CATEGORIES.map(category=>`<option ${category===item.category?'selected':''}>${esc(category)}</option>`).join('')}</select><small>${esc(item.status)} · Qty ${item.quantity} · ${esc(item.confidence)} confidence${duplicate?' · <span class="duplicate">Possible duplicate — review before adding</span>':''}</small></div></label>`;}).join('')}</div><div class="button-row" style="margin-top:14px"><button class="primary" type="button" data-smart-sort-import>Import selected</button><button class="secondary" type="button" data-smart-sort-close>Cancel</button></div>`;
    previewEl.querySelectorAll('[data-smart-sort-close]').forEach(button=>button.addEventListener('click',closeModal));previewEl.querySelector('[data-smart-sort-import]')?.addEventListener('click',()=>importSelected(parsed));
  }
  function importSelected(parsed){
    const selected=parsed.map((item,index)=>({item,index})).filter(({index})=>document.querySelector(`[data-smart-sort-select="${index}"]`)?.checked);if(!selected.length)return;const data=readData();localStorage.setItem(BACKUP_KEY,JSON.stringify({savedAt:Date.now(),data:JSON.parse(JSON.stringify(data))}));
    selected.forEach(({item,index})=>{const category=document.querySelector(`[data-smart-sort-category="${index}"]`)?.value||item.category;rememberCategory(item.name,category);data.products.push({id:uid(),name:item.name,brand:inferBrand(item.name),category,status:item.status,quantity:item.quantity,remaining:item.status==='Unopened / Backup'?100:null,tags:inferTags(item.name),notes:'',size:'',shade:'',price:'',currency:'PHP',purchaseDate:'',openedDate:'',expiryDate:'',pao:'',barcode:'',sourceUrl:'',sourceName:'',ingredients:'',image:'',createdAt:Date.now(),updatedAt:Date.now()});});writeData(data);closeModal();location.reload();
  }
  function sortExisting(){
    const data=readData(),changes=[];data.products.forEach(product=>{if(product.category&&product.category!=='Other')return;const category=smartCategory(product.name);if(category)changes.push({product,category});});if(!changes.length)return showToast('No uncategorized skincare found');if(!confirm(`Smart sort ${changes.length} uncategorized skincare product${changes.length===1?'':'s'}? Existing non-Other categories will not be changed.`))return;
    localStorage.setItem(BACKUP_KEY,JSON.stringify({savedAt:Date.now(),data:JSON.parse(JSON.stringify(data))}));changes.forEach(({product,category})=>{product.category=category;product.updatedAt=Date.now();rememberCategory(product.name,category);});writeData(data);location.reload();
  }
  function undo(){
    try{const backup=JSON.parse(localStorage.getItem(BACKUP_KEY)||'null');if(!backup?.data||!Array.isArray(backup.data.products))return;if(!confirm('Restore your Stash to the state before the last skincare Smart Sort?'))return;writeData(backup.data);localStorage.removeItem(BACKUP_KEY);location.reload();}catch(_){}
  }
  function showToast(message){const toast=document.getElementById('toast');if(!toast)return;toast.textContent=message;toast.classList.remove('hidden');setTimeout(()=>toast.classList.add('hidden'),1800);}

  function observeEditors(){const sheet=document.getElementById('sheetContent');if(!sheet)return;let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhanceProductEditor();});}).observe(sheet,{childList:true,subtree:true});enhanceProductEditor();}

  window.IchigoSkincareSort={CATEGORIES,CATEGORY_SET,DATA_KEY,BACKUP_KEY,norm,readData,writeData,smartCategory,isSkincareProduct,rememberCategory,openModal,sortExisting,undo};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeEditors,{once:true});else observeEditors();
})();
