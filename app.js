/* Ichigo Recovery Build 9.2 — canonical runtime version. */
const ICHIGO_CURRENT_VERSION = "9.2.0";
const ICHIGO_CURRENT_SCHEMA = 9;

/* ==========================================================
   ICHIGO BUILD 1
   Local-first travel planner. No backend required.
   Data is stored in localStorage so the prototype works offline.
   ========================================================== */

"use strict";


/* ==========================================================
   NATIVE-APP STYLE ZOOM LOCK
   Extra protection for iOS Safari / installed PWA gestures.
   ========================================================== */
(function lockAppZoom() {
  let lastTouchEnd = 0;

  ["gesturestart", "gesturechange", "gestureend"].forEach(type => {
    document.addEventListener(type, event => {
      event.preventDefault();
    }, { passive: false });
  });

  document.addEventListener("touchmove", event => {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("touchend", event => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
})();


const STORE = "ichigo-build1-v1";
const RATE_STORE = "ichigo-rates-v1";

const DEFAULT_RATES = {JPY:1,PHP:.37,USD:.0067,GBP:.0051,EUR:.0058,SGD:.0086,HKD:.052,CNY:.048};
const SYMBOL = {JPY:"¥",PHP:"₱",USD:"$",GBP:"£",EUR:"€",SGD:"S$",HKD:"HK$",CNY:"¥"};
const ICON = {cafe:"☕",food:"🍜",transport:"🚃",shopping:"🛍️",activity:"🎟️",accommodation:"🏨",attraction:"⛩️",place:"📍",booking:"🎫",other:"✨"};

const uuid=()=>crypto.randomUUID();
const clone=x=>structuredClone(x);

const initial={
  currentTripId:"",
  currentView:"home",
  planView:"itinerary",
  spendView:"budget",
  tripView:"memories",
  trips:[]
};
let state=load();
let installPrompt=null;

const main=document.querySelector("#mainView");
const modalRoot=document.querySelector("#modalRoot");
const toastRoot=document.querySelector("#toastRoot");
const installBtn=document.querySelector("#installBtn");

function load(){
  try{
    const raw=localStorage.getItem(STORE);
    if(!raw)return clone(initial);
    const x=JSON.parse(raw);
    return Array.isArray(x.trips)?x:clone(initial);
  }catch{return clone(initial)}
}
function save(){localStorage.setItem(STORE,JSON.stringify(state))}
function trip(){return state.trips.find(x=>x.id===state.currentTripId)||state.trips[0]}
function esc(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function parseDate(s){if(!s)return null;const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function isoToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function nice(s,o={month:"short",day:"numeric"}){const d=parseDate(s);return d?d.toLocaleDateString(undefined,o):""}
function daysBetween(a,b){return Math.max(1,Math.round((parseDate(b)-parseDate(a))/86400000)+1)}
function daysUntil(s){const a=new Date();a.setHours(0,0,0,0);return Math.ceil((parseDate(s)-a)/86400000)}
function status(t=trip()){const now=parseDate(isoToday()),a=parseDate(t.startDate),b=parseDate(t.endDate);return now<a?"planning":now>b?"completed":"active"}
function allDates(t=trip()){const arr=[],a=parseDate(t.startDate),b=parseDate(t.endDate);if(!a||!b)return arr;for(const d=new Date(a);d<=b;d.setDate(d.getDate()+1))arr.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);return arr}
function dayNo(s,t=trip()){return Math.max(1,Math.floor((parseDate(s)-parseDate(t.startDate))/86400000)+1)}
function activeDate(t=trip()){if(status(t)==="active")return isoToday();return [...new Set(t.itinerary.map(x=>x.date))].sort()[0]||t.startDate}
function money(n,c=trip().baseCurrency){return `${SYMBOL[c]||c+" "}${Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2})}`}
function spent(t=trip()){return t.expenses.reduce((s,x)=>s+Number(x.amount||0),0)}
function spentDate(d,t=trip()){return t.expenses.filter(x=>x.date===d).reduce((s,x)=>s+Number(x.amount||0),0)}
function traveler(id){return trip().travelers.find(x=>x.id===id)?.name||"Someone"}
function notify(msg){const d=document.createElement("div");d.className="toast";d.textContent=msg;toastRoot.append(d);setTimeout(()=>d.remove(),2400)}
function pct(t=trip()){const x=[t.itinerary.length,t.places.length,t.bookings.length,t.packing.some(i=>i.done),t.preTrip.some(i=>i.done),t.totalBudget];return Math.round(x.filter(Boolean).length/x.length*100)}
function empty(e,h,p,type=""){return `<div class="card empty"><div class="emoji">${e}</div><h3>${h}</h3><p>${p}</p>${type?`<button class="btn soft" data-action="quick-add-type" data-type="${type}">＋ Add</button>`:""}</div>`}
function categoryEmoji(c=""){c=c.toLowerCase();if(c.includes("café")||c.includes("cafe"))return"☕";if(c.includes("food")||c.includes("restaurant"))return"🍜";if(c.includes("shop"))return"🛍️";if(c.includes("attraction"))return"⛩️";return"📍"}
function bookEmoji(c=""){c=c.toLowerCase();if(c.includes("flight"))return"✈️";if(c.includes("hotel"))return"🏨";if(c.includes("train"))return"🚄";if(c.includes("reservation"))return"🍽️";return"🎟️"}
function normCat(c=""){c=c.toLowerCase();if(/food|restaurant|cafe|café/.test(c))return"Food";if(/transport|train|taxi/.test(c))return"Transport";if(c.includes("shop"))return"Shopping";if(/hotel|accom/.test(c))return"Accommodation";if(/activ|ticket/.test(c))return"Activities";return"Other"}
function expenseEmoji(c){return({Food:"🍜",Transport:"🚃",Shopping:"🛍️",Accommodation:"🏨",Activities:"🎟️",Other:"✨"})[normCat(c)]}
function currencyOptions(sel){return Object.keys(DEFAULT_RATES).map(x=>`<option ${x===sel?"selected":""}>${x}</option>`).join("")}

function updateOnline(){
  const dot=document.querySelector("#onlineDot");
  if(dot)dot.classList.toggle("offline",!navigator.onLine)
}

function render(){
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.nav===state.currentView));
  ({home:renderHome,plan:renderPlan,today:renderToday,spend:renderSpend,together:renderTogether,trip:renderTrip}[state.currentView]||renderHome)();
  updateOnline()
}

function renderHome(){
  const t=trip(),st=status(t),s=spent(t),pack=t.packing.filter(x=>x.done).length,packPct=t.packing.length?Math.round(pack/t.packing.length*100):0;
  const next=[...t.itinerary].sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
  const countdown=st==="planning"?`${daysUntil(t.startDate)} days to go! 🌸`:st==="active"?`DAY ${dayNo(isoToday(),t)} · ${t.cityLabel} 🍓`:`${daysBetween(t.startDate,t.endDate)} days · a sweet little memory 📖`;
  main.innerHTML=`
    <section class="hero-card">
      <div class="hero-content"><h1>${esc(t.title)} ${esc(t.countryEmoji)}</h1><p class="hero-countdown">${countdown}</p><p class="hero-dates">${nice(t.startDate)} – ${nice(t.endDate,{month:"short",day:"numeric",year:"numeric"})}</p></div>
      <div class="hero-progress" style="--progress:${pct(t)}%"><span>${pct(t)}%</span></div>
      <div class="hero-stats">
        <div class="hero-stat"><strong>🗓 ${t.itinerary.length}</strong><small>Plans</small></div>
        <div class="hero-stat"><strong>📍 ${t.places.length}</strong><small>Places</small></div>
        <div class="hero-stat"><strong>🎟 ${t.bookings.length}</strong><small>Bookings</small></div>
        <div class="hero-stat"><strong>💰 ${money(t.totalBudget)}</strong><small>Budget</small></div>
      </div>
    </section>

    <section class="section"><div class="grid-2">
      <button class="card mini-card" data-action="open-feature" data-feature="itinerary"><h3>Next Up</h3>${next?`<div class="big-number" style="font-size:16px">${nice(next.date,{weekday:"short",month:"short",day:"numeric"})}</div><div class="meta">${esc(next.time)} · ${esc(next.title)}</div>`:`<div class="meta">No plans yet</div>`}</button>
      <button class="card mini-card" data-action="open-feature" data-feature="budget"><h3>Budget</h3><div class="big-number">${money(Math.max(0,t.totalBudget-s))}</div><div class="meta">left of ${money(t.totalBudget)}</div><div class="progress"><span style="width:${Math.min(100,t.totalBudget?s/t.totalBudget*100:0)}%"></span></div></button>
      <button class="card mini-card" data-action="open-feature" data-feature="bookings"><h3>Bookings</h3><div class="big-number">${t.bookings.length}</div><div class="meta">${t.bookings[0]?`Next: ${esc(t.bookings[0].title)}`:"Add your first booking"}</div></button>
      <button class="card mini-card" data-action="open-feature" data-feature="packing"><h3>Packing</h3><div class="big-number">${packPct}%</div><div class="meta">${pack}/${t.packing.length} items</div><div class="progress"><span style="width:${packPct}%"></span></div></button>
    </div></section>

    <section class="section"><div class="section-title"><h3>Quick Add</h3></div>
      <div class="quick-grid">
        <button class="quick-btn" data-action="quick-add-type" data-type="activity"><span>🗓️</span><small>Activity</small></button>
        <button class="quick-btn" data-action="quick-add-type" data-type="place"><span>📍</span><small>Place</small></button>
        <button class="quick-btn" data-action="quick-add-type" data-type="expense"><span>💸</span><small>Expense</small></button>
        <button class="quick-btn" data-action="quick-add-type" data-type="booking"><span>🎟️</span><small>Booking</small></button>
        <button class="quick-btn" data-action="quick-add-type" data-type="memory"><span>📸</span><small>Memory</small></button>
      </div>
      <div class="card sweet-banner"><div class="mascot">🍓</div><div><strong>${st==="completed"?"Your trip is now a memory.":"Let's plan something sweet!"}</strong><p>${st==="completed"?"Open Trip Recap to revisit it.":"Plan it, live it, remember it — all in one place."}</p></div></div>
    </section>

    <section class="section"><div class="section-title"><h3>Your trips</h3><button data-action="new-trip">＋ New trip</button></div>
      <div class="travel-shelf">${state.trips.map(x=>`<button class="card shelf-card" data-action="switch-trip" data-id="${x.id}"><h3>${esc(x.countryEmoji)} ${esc(x.title)}</h3><p>${nice(x.startDate)} – ${nice(x.endDate,{month:"short",day:"numeric",year:"numeric"})} · ${x.itinerary.length} plans · ${x.places.length} places</p></button>`).join("")}</div>
    </section>`
}

function renderPlan(){
  const menu=[["itinerary","🗓️","Itinerary"],["places","📍","Places"],["bookings","🎟️","Bookings"],["packing","🧳","Packing"],["before","✅","Before You Go"]];
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">PLAN</p><h1>Plan your trip</h1><p>${esc(trip().title)}</p></div><button class="btn soft" data-action="open-quick-add">＋ Add</button></div>
  <div class="chips">${menu.map(([k,e,l])=>`<button class="chip ${state.planView===k?"active":""}" data-action="set-plan-view" data-feature="${k}">${e} ${l}</button>`).join("")}</div>
  <section class="section">${planHTML(state.planView)}</section>`
}
function planHTML(v){return v==="places"?placesHTML():v==="bookings"?bookingsHTML():v==="packing"?packingHTML():v==="before"?beforeHTML():itineraryHTML(activeDate())}

function itineraryHTML(date){
  const t=trip(),items=t.itinerary.filter(x=>x.date===date).sort((a,b)=>a.time.localeCompare(b.time));
  return `<div class="section-title"><h3>🗓️ Itinerary</h3><button data-action="quick-add-type" data-type="activity">＋ Activity</button></div>
  <div class="chips">${allDates(t).map(d=>`<button class="chip ${d===date?"active":""}" data-action="show-itinerary-date" data-date="${d}">Day ${dayNo(d,t)} · ${nice(d)}</button>`).join("")}</div>
  <div id="itineraryDay">${items.length?`<div class="card" style="padding:16px;margin-top:10px"><div class="timeline">${items.map(i=>`<div class="timeline-item"><div class="timeline-time">${esc(i.time||"Anytime")}</div><div class="timeline-dot"></div><div class="timeline-content"><strong>${ICON[i.type]||"📍"} ${esc(i.title)}</strong><small>${esc(i.place)}${i.notes?` · ${esc(i.notes)}`:""}</small><div style="margin-top:7px"><button class="tiny-btn danger" data-action="delete-item" data-collection="itinerary" data-id="${i.id}">Delete</button></div></div></div>`).join("")}</div></div>`:empty("🗓️","Nothing planned yet","Add an activity to this day.","activity")}</div>`
}

function placesHTML(){
  const t=trip(),cats=["All",...new Set(t.places.map(x=>x.category))];
  return `<div class="section-title"><h3>📍 Places</h3><button data-action="quick-add-type" data-type="place">＋ Place</button></div>
  <div class="searchbox"><input id="placeSearch" placeholder="Search saved places..."></div>
  <div class="chips" style="margin-top:8px">${cats.map((c,i)=>`<button class="chip ${i===0?"active":""}" data-action="filter-places" data-category="${esc(c)}">${esc(c)}</button>`).join("")}</div>
  <div id="placeList" class="list" style="margin-top:10px">${placeRows(t.places)}</div>`
}
function placeRows(arr){
  if(!arr.length)return empty("📍","No saved places","Save cafés, restaurants, shops and attractions.","place");
  return arr.map(p=>`<div class="list-row"><div class="row-icon">${categoryEmoji(p.category)}</div><div class="row-main"><h4>${esc(p.name)}</h4><p>${esc(p.area)} · ${esc(p.category)} ${p.visited?"· ✓ Visited":""}</p><div class="vote-group" style="margin-top:7px">${["❤️","👍","😐","👎"].map(v=>`<button class="vote ${Object.values(p.votes||{}).includes(v)?"active":""}" data-action="vote-place" data-id="${p.id}" data-vote="${v}">${v}</button>`).join("")}</div></div><div class="row-trailing"><button class="tiny-btn" data-action="toggle-visited" data-id="${p.id}">${p.visited?"Visited ✓":"Mark visited"}</button><div style="margin-top:5px"><button class="tiny-btn danger" data-action="delete-item" data-collection="places" data-id="${p.id}">Delete</button></div></div></div>`).join("")
}

function bookingsHTML(){
  const t=trip(),arr=[...t.bookings].sort((a,b)=>a.date.localeCompare(b.date));
  return `<div class="section-title"><h3>🎟️ Bookings</h3><button data-action="quick-add-type" data-type="booking">＋ Booking</button></div>
  <div class="chips">${["All","Flight","Hotel","Train","Ticket","Reservation"].map((c,i)=>`<button class="chip ${i===0?"active":""}" data-action="filter-bookings" data-category="${c}">${c}</button>`).join("")}</div>
  <div id="bookingList" class="list" style="margin-top:10px">${arr.length?bookingRows(arr):empty("🎟️","No bookings yet","Keep flights, hotels and tickets together.","booking")}</div>`
}
function bookingRows(arr){return arr.map(b=>`<div class="list-row"><div class="row-icon">${bookEmoji(b.type)}</div><div class="row-main"><h4>${esc(b.title)}</h4><p>${nice(b.date,{month:"short",day:"numeric",year:"numeric"})}${b.time?` · ${esc(b.time)}`:""} · ${esc(b.confirmation||"No confirmation")}</p>${b.notes?`<p>${esc(b.notes)}</p>`:""}</div><div class="row-trailing"><span class="pill">${esc(b.status||"Saved")}</span><div style="margin-top:5px"><button class="tiny-btn danger" data-action="delete-item" data-collection="bookings" data-id="${b.id}">Delete</button></div></div></div>`).join("")}

function packingHTML(){
  const t=trip(),cats=[...new Set(t.packing.map(x=>x.category))],done=t.packing.filter(x=>x.done).length,p=t.packing.length?Math.round(done/t.packing.length*100):0;
  return `<div class="section-title"><h3>🧳 Packing</h3><button data-action="quick-add-type" data-type="packing">＋ Item</button></div>
  <div class="card" style="padding:15px"><div style="display:flex;justify-content:space-between"><strong>Overall progress</strong><strong>${p}%</strong></div><div class="progress"><span style="width:${p}%;background:linear-gradient(90deg,#6ab88d,#96d2af)"></span></div></div>
  ${cats.map(c=>`<div class="card" style="padding:13px 15px;margin-top:10px"><div class="section-title"><h3>${esc(c)}</h3><span class="meta">${t.packing.filter(x=>x.category===c&&x.done).length}/${t.packing.filter(x=>x.category===c).length}</span></div>${t.packing.filter(x=>x.category===c).map(i=>`<label class="check-row ${i.done?"done":""}"><input type="checkbox" ${i.done?"checked":""} data-action="toggle-pack" data-id="${i.id}"><span class="check-name">${esc(i.name)}</span><button class="tiny-btn danger" type="button" data-action="delete-item" data-collection="packing" data-id="${i.id}">✕</button></label>`).join("")}</div>`).join("")||empty("🧳","Packing list is empty","Start with your essentials.","packing")}`
}
function beforeHTML(){
  const t=trip();return `<div class="section-title"><h3>✅ Before You Go</h3><button data-action="quick-add-type" data-type="task">＋ Task</button></div><div class="card" style="padding:13px 15px">${t.preTrip.length?t.preTrip.map(i=>`<label class="check-row ${i.done?"done":""}"><input type="checkbox" ${i.done?"checked":""} data-action="toggle-pretrip" data-id="${i.id}"><span><span class="check-name">${esc(i.name)}</span><small style="display:block;color:var(--muted);margin-top:2px">${esc(i.detail||"")}</small></span><button class="tiny-btn danger" type="button" data-action="delete-item" data-collection="preTrip" data-id="${i.id}">✕</button></label>`).join(""):empty("✅","Nothing here yet","Add visa, insurance, SIM, documents and other prep.","task")}</div>`
}

function renderToday(){
  const t=trip(),d=activeDate(t),items=t.itinerary.filter(x=>x.date===d).sort((a,b)=>a.time.localeCompare(b.time)),todaySpent=spentDate(d,t),next=items[0];
  main.innerHTML=`<section class="today-header"><p class="eyebrow" style="color:#8b3044!important">${esc(t.cityLabel||t.destination)} · DAY ${dayNo(d,t)}</p><h1>${nice(d,{weekday:"long",month:"long",day:"numeric"})}</h1><p>${status(t)==="active"?"Your live travel day":"Previewing Today Mode"}</p></section>
  ${items.length?`<section class="card" style="padding:16px"><div class="timeline">${items.map(i=>`<div class="timeline-item"><div class="timeline-time">${esc(i.time)}</div><div class="timeline-dot"></div><div class="timeline-content"><strong>${ICON[i.type]||"📍"} ${esc(i.title)}</strong><small>${esc(i.place)}${i.notes?` · ${esc(i.notes)}`:""}</small></div></div>`).join("")}</div></section>`:empty("🌸","Your day is still open","Add activities to see them here.","activity")}
  <section class="card" style="padding:16px;margin-top:12px;background:linear-gradient(145deg,#fff,#fff0f3)"><div class="section-title"><h3>Today's spending</h3><span>${money(todaySpent)} / ${money(t.dailyBudget)}</span></div><div class="progress"><span style="width:${Math.min(100,t.dailyBudget?todaySpent/t.dailyBudget*100:0)}%"></span></div></section>
  ${next?`<section class="card list-row next-up-card" style="margin-top:12px"><div class="row-icon">${ICON[next.type]||"📍"}</div><div class="row-main"><h4>Next: ${esc(next.title)}</h4><p>${esc(next.time)} · ${esc(next.place)}</p></div></section>`:""}
  <section class="section"><div class="grid-3"><button class="btn soft" data-action="quick-add-type" data-type="expense">＋ Expense</button><button class="btn soft" data-action="open-feature" data-feature="converter">💱 Convert</button><button class="btn soft" data-action="open-feature" data-feature="places">📍 Places</button></div></section>
  <section class="card sweet-banner"><div class="mascot">${navigator.onLine?"📶":"✈️"}</div><div><strong>${navigator.onLine?"You're online.":"Offline mode is working."}</strong><p>Your saved itinerary, bookings, expenses and converter remain available on this device.</p></div></section>`
}

function renderSpend(){
  const menu=[["budget","💰","Budget"],["expenses","🧾","Expenses"],["converter","💱","Converter"],["split","💸","Split"]];
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">SPEND</p><h1>Trip money</h1><p>${esc(trip().title)}</p></div><button class="btn soft" data-action="quick-add-type" data-type="expense">＋ Expense</button></div><div class="chips">${menu.map(([k,e,l])=>`<button class="chip ${state.spendView===k?"active":""}" data-action="set-spend-view" data-feature="${k}">${e} ${l}</button>`).join("")}</div><section class="section">${spendHTML(state.spendView)}</section>`
}
function spendHTML(v){return v==="expenses"?expensesHTML():v==="converter"?converterHTML():v==="split"?splitHTML():budgetHTML()}

function budgetHTML(){
  const t=trip(),s=spent(t),cats=["Accommodation","Food","Transport","Shopping","Activities","Other"];
  return `<div class="section-title"><h3>💰 Budget</h3><button data-action="edit-budget">Edit budget</button></div><div class="card" style="padding:17px"><p class="meta">Total Budget</p><div class="big-number">${money(t.totalBudget)}</div><div class="progress"><span style="width:${Math.min(100,t.totalBudget?s/t.totalBudget*100:0)}%"></span></div><div class="grid-2" style="margin-top:14px"><div><span class="meta">Remaining</span><div style="font-weight:800">${money(Math.max(0,t.totalBudget-s))}</div></div><div><span class="meta">Spent</span><div style="font-weight:800">${money(s)}</div></div></div></div>
  <div class="card" style="padding:15px;margin-top:10px"><div class="section-title"><h3>By category</h3></div>${cats.map(c=>{const v=t.expenses.filter(e=>normCat(e.category)===c).reduce((a,b)=>a+Number(b.amount),0),p=s?v/s*100:0;return `<div class="budget-category"><span>${expenseEmoji(c)}</span><div><strong>${c}</strong><div class="progress"><span style="width:${p}%"></span></div></div><small>${money(v)}</small></div>`}).join("")}</div>`
}
function expensesHTML(){
  const t=trip(),arr=[...t.expenses].sort((a,b)=>b.date.localeCompare(a.date));
  return `<div class="section-title"><h3>🧾 Expenses</h3><button data-action="quick-add-type" data-type="expense">＋ Expense</button></div><div class="card" style="padding:16px;margin-bottom:10px"><div class="meta">Total spent</div><div class="big-number">${money(spent(t))}</div><div class="meta">${t.expenses.length} expense${t.expenses.length===1?"":"s"}</div></div><div class="list">${arr.length?arr.map(e=>`<div class="list-row"><div class="row-icon">${expenseEmoji(e.category)}</div><div class="row-main"><h4>${esc(e.title)}</h4><p>${nice(e.date)} · ${esc(e.category)} · ${esc(e.payment||"Other")}</p>${e.split==="equal"?`<p>Paid by ${traveler(e.paidBy)} · split with ${e.participants.length}</p>`:""}</div><div class="row-trailing"><strong>${money(e.amount)}</strong><div style="margin-top:5px"><button class="tiny-btn danger" data-action="delete-item" data-collection="expenses" data-id="${e.id}">Delete</button></div></div></div>`).join(""):empty("🧾","No expenses yet","Track spending as you travel.","expense")}</div>`
}

function rates(){try{return {...DEFAULT_RATES,...JSON.parse(localStorage.getItem(RATE_STORE)||"{}")}}catch{return {...DEFAULT_RATES}}}
function rateBetween(a,b,r=rates()){if(a===b)return 1;return (1/Number(r[a]||1))*Number(r[b]||1)}
function safeEval(v){const s=String(v).replaceAll("×","*").replaceAll("÷","/").replaceAll("−","-").replace(/\s+/g,"");if(!s||!/^[0-9+\-*/().]+$/.test(s))throw Error("Use numbers and + − × ÷ only.");const n=Function(`"use strict";return (${s})`)();if(!Number.isFinite(n))throw Error("Invalid calculation.");return n}
function converterHTML(){
  return `<div class="section-title"><h3>💱 Converter</h3><span class="meta">Saved offline rates</span></div><div class="card converter-card">
  <div class="form-row two"><div><label>FROM</label><select id="convFrom">${currencyOptions("JPY")}</select></div><div><label>TO</label><select id="convTo">${currencyOptions("PHP")}</select></div></div>
  <input id="convExpression" class="calc-input" value="6420" inputmode="decimal" placeholder="5+89+678">
  <div class="currency-box"><div class="currency-head"><span class="currency-code" id="fromCode">JPY</span><small class="meta">Original total</small></div><div class="currency-amount" id="convOriginal">¥6,420</div></div><div style="text-align:center;margin:7px">⇅</div>
  <div class="currency-box"><div class="currency-head"><span class="currency-code" id="toCode">PHP</span><small class="meta">Converted</small></div><div class="currency-amount" id="convResult">${money(6420*rateBetween("JPY","PHP"),"PHP")}</div></div>
  <div class="keypad">${["7","8","9","÷","4","5","6","×","1","2","3","−","C","0",".","+"].map(k=>`<button class="key ${["÷","×","−","+"].includes(k)?"op":""}" data-action="calc-key" data-key="${k}">${k}</button>`).join("")}</div><button class="key equal" style="width:100%;margin-top:8px" data-action="calculate">= Convert</button>
  <details style="margin-top:12px"><summary class="meta">Edit offline exchange rates</summary><div class="form-grid" style="margin-top:10px">${["PHP","USD","GBP","EUR","SGD","HKD","CNY"].map(c=>`<div class="form-row two"><label>1 JPY → ${c}</label><input id="rate_${c}" type="number" step="any" value="${rates()[c]}"></div>`).join("")}<button class="btn soft" data-action="save-rates">Save rates</button></div></details>
  </div>`
}
function calcBalances(){
  const t=trip(),b=Object.fromEntries(t.travelers.map(x=>[x.id,0]));
  t.expenses.filter(e=>e.split==="equal"&&e.participants?.length>1).forEach(e=>{const share=Number(e.amount)/e.participants.length;e.participants.forEach(p=>{if(p!==e.paidBy){b[p]=(b[p]||0)-share;b[e.paidBy]=(b[e.paidBy]||0)+share}})});
  return b
}
function settlement(){
  const b=calcBalances(),deb=Object.entries(b).filter(([,v])=>v<-.01).sort((a,b)=>a[1]-b[1]),cred=Object.entries(b).filter(([,v])=>v>.01).sort((a,b)=>b[1]-a[1]);
  if(!deb.length||!cred.length)return{text:"You're all even ✓",amount:0};return{text:`${traveler(deb[0][0])} → ${traveler(cred[0][0])}`,amount:Math.min(Math.abs(deb[0][1]),cred[0][1])}
}
function splitHTML(){
  const t=trip(),s=settlement(),arr=t.expenses.filter(e=>e.split==="equal"&&e.participants.length>1);
  return `<div class="section-title"><h3>💸 Split Expenses</h3><button data-action="quick-add-type" data-type="expense">＋ Shared expense</button></div><div class="card balance-card"><div class="meta">Settlement</div><div class="amount">${money(s.amount)}</div><strong>${esc(s.text)}</strong><p class="meta">Shared equal splits are netted automatically.</p></div><div class="section-title" style="margin-top:15px"><h3>Shared expenses</h3></div><div class="list">${arr.length?arr.map(e=>`<div class="list-row"><div class="row-icon">💸</div><div class="row-main"><h4>${esc(e.title)}</h4><p>Paid by ${traveler(e.paidBy)} · ${e.participants.length} people</p></div><strong>${money(e.amount)}</strong></div>`).join(""):empty("💸","No shared expenses","Add an expense and select equal split.","expense")}</div>`
}

function renderTogether(){
  const t=trip(),matches=t.places.filter(p=>{const v=Object.values(p.votes||{});return v.length&&t.travelers.length<=v.length&&v.every(x=>["❤️","👍"].includes(x))});
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">TOGETHER</p><h1>Travel Together</h1><p>Plan, vote and split expenses</p></div><button class="btn soft" data-action="invite-traveler">＋ Invite</button></div>
  <section class="section"><div class="section-title"><h3>Travelers</h3></div><div class="card" style="padding:8px 13px">${t.travelers.map(x=>`<div class="list-row" style="border:0"><div class="row-icon">${x.emoji||"🙂"}</div><div class="row-main"><h4>${esc(x.name)}</h4><p>${esc(x.role)}</p></div></div>`).join("")}</div></section>
  <section class="section"><div class="section-title"><h3>💗 Group Picks</h3><span class="meta">${matches.length} matches</span></div><div class="list">${matches.length?matches.map(p=>`<div class="list-row"><div class="row-icon">${categoryEmoji(p.category)}</div><div class="row-main"><h4>${esc(p.name)}</h4><p>${esc(p.area)} · everyone is interested</p></div><span>💗</span></div>`).join("") : empty("💗","No group matches yet","Vote on saved places to discover shared favorites.")}</div></section>
  <section class="section">${splitHTML()}</section>`
}

function renderTrip(){
  const menu=[["memories","📸","Memories"],["recap","📊","Trip Recap"],["info","ℹ️","Trip Info"],["settings","⚙️","Settings"]];
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">TRIP</p><h1>${esc(trip().title)}</h1><p>Your trip story and settings</p></div></div><div class="chips">${menu.map(([k,e,l])=>`<button class="chip ${state.tripView===k?"active":""}" data-action="set-trip-view" data-feature="${k}">${e} ${l}</button>`).join("")}</div><section class="section">${tripHTML(state.tripView)}</section>`
}
function tripHTML(v){return v==="recap"?recapHTML():v==="info"?infoHTML():v==="settings"?settingsHTML():memoriesHTML()}
function memoriesHTML(){
  const t=trip();return `<div class="section-title"><h3>📸 Memories</h3><button data-action="quick-add-type" data-type="memory">＋ Memory</button></div>${t.memories.length?`<div class="memory-grid">${t.memories.map(m=>`<button class="memory-tile" data-action="view-memory" data-id="${m.id}">${m.image?`<img src="${m.image}" alt="">`:"<span>📸</span>"}<small>${esc(m.title||nice(m.date))}</small></button>`).join("")}</div>`:empty("📸","Your scrapbook starts here","Add a photo or tiny journal note during the trip.","memory")}`
}
function recapHTML(){
  const t=trip(),s=spent(t),visited=t.places.filter(x=>x.visited).length,food=t.expenses.filter(x=>normCat(x.category)==="Food").length,trans=t.expenses.filter(x=>normCat(x.category)==="Transport").length;
  return `<div class="card" style="padding:18px"><p class="eyebrow">YOUR TRIP STORY</p><h2 style="margin:0">${esc(t.countryEmoji)} ${esc(t.title)}</h2><p class="meta">${nice(t.startDate)} – ${nice(t.endDate,{month:"short",day:"numeric",year:"numeric"})}</p><div class="big-number">${money(s)} spent</div><div class="stats-grid"><div class="stat-card"><strong>${daysBetween(t.startDate,t.endDate)}</strong><small>Days</small></div><div class="stat-card"><strong>${visited}</strong><small>Places visited</small></div><div class="stat-card"><strong>${t.memories.length}</strong><small>Memories</small></div><div class="stat-card"><strong>${food}</strong><small>Food entries</small></div><div class="stat-card"><strong>${trans}</strong><small>Transit entries</small></div><div class="stat-card"><strong>${t.itinerary.length}</strong><small>Plans</small></div></div></div>
  <section class="section"><div class="section-title"><h3>Little trip scrapbook</h3></div>${allDates(t).map(d=>{const plans=t.itinerary.filter(i=>i.date===d),mem=t.memories.filter(m=>m.date===d);if(!plans.length&&!mem.length)return"";return`<div class="card" style="padding:14px;margin-bottom:9px"><strong>DAY ${dayNo(d,t)} · ${nice(d)}</strong><p class="meta">${plans.map(p=>esc(p.title)).join(" · ")||"Free day"}</p>${mem.length?`<div class="memory-grid">${mem.slice(0,3).map(m=>`<div class="memory-tile">${m.image?`<img src="${m.image}">`:"<span>📸</span>"}</div>`).join("")}</div>`:""}</div>`}).join("")||empty("📖","Your recap will grow as you travel","")}</section>`
}
function infoHTML(){
  const t=trip();return `<div class="card" style="padding:16px"><div class="form-grid"><div class="form-row"><label>TRIP NAME</label><input id="infoTitle" value="${esc(t.title)}"></div><div class="form-row"><label>DESTINATION</label><input id="infoDestination" value="${esc(t.destination)}"></div><div class="form-row two"><div><label>START</label><input id="infoStart" type="date" value="${t.startDate}"></div><div><label>END</label><input id="infoEnd" type="date" value="${t.endDate}"></div></div><div class="form-row two"><div><label>BASE CURRENCY</label><select id="infoCurrency">${currencyOptions(t.baseCurrency)}</select></div><div><label>HOME CURRENCY</label><select id="infoHomeCurrency">${currencyOptions(t.homeCurrency)}</select></div></div><button class="btn primary" data-action="save-trip-info">Save trip info</button></div></div>`
}
function settingsHTML(){
  return `<div class="card" style="padding:16px"><div class="section-title"><h3>Local data</h3></div><p class="meta">Build 1 stores your trip on this device. No login or backend is required.</p><div class="btn-row" style="margin-top:12px"><button class="btn soft" data-action="export-data">Export backup</button><button class="btn" data-action="import-data">Import backup</button></div><input id="importFile" type="file" accept="application/json" hidden><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><div class="section-title"><h3>PWA / offline</h3></div><p class="meta">Install Ichigo from your browser. The app shell is cached by the service worker.</p><button class="btn soft" data-action="install-app">Install Ichigo</button><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><button class="btn danger full" data-action="reset-demo">Reset all local data</button></div>`
}

function openModal(title,html){
  const tpl=document.querySelector("#modalTemplate"),node=tpl.content.cloneNode(true);modalRoot.replaceChildren(node);modalRoot.querySelector("#modalTitle").textContent=title;modalRoot.querySelector("#modalBody").innerHTML=html
}
function closeModal(){modalRoot.innerHTML=""}
function quick(type){
  const t=trip();
  if(!type){openModal("Quick Add",`<div class="grid-2">${[["activity","🗓️","Activity"],["place","📍","Place"],["expense","💸","Expense"],["booking","🎟️","Booking"],["packing","🧳","Packing Item"],["task","✅","Pre-trip Task"],["memory","📸","Memory"],["trip","🍓","New Trip"]].map(([k,e,l])=>`<button class="feature-btn" data-action="quick-add-type" data-type="${k}"><span class="feature-icon">${e}</span><span><strong>${l}</strong></span><span class="arrow">›</span></button>`).join("")}</div>`);return}
  if(type==="trip"){newTrip();return}
  const forms={
    activity:`<form id="activityForm" class="form-grid"><div class="form-row"><label>DATE</label><input name="date" type="date" value="${activeDate(t)}" required></div><div class="form-row two"><div><label>TIME</label><input name="time" type="time"></div><div><label>TYPE</label><select name="type"><option value="place">Place</option><option value="cafe">Café</option><option value="food">Food</option><option value="transport">Transport</option><option value="attraction">Attraction</option><option value="shopping">Shopping</option></select></div></div><div class="form-row"><label>ACTIVITY</label><input name="title" required placeholder="Hasedera Temple"></div><div class="form-row"><label>PLACE / AREA</label><input name="place" placeholder="Kamakura"></div><div class="form-row"><label>NOTES</label><textarea name="notes"></textarea></div><button class="btn primary">Add to itinerary</button></form>`,
    place:`<form id="placeForm" class="form-grid"><div class="form-row"><label>PLACE NAME</label><input name="name" required placeholder="Pokémon Café"></div><div class="form-row two"><div><label>AREA</label><input name="area"></div><div><label>CATEGORY</label><select name="category"><option>Café</option><option>Restaurant</option><option>Attraction</option><option>Shopping</option><option>Other</option></select></div></div><div class="form-row"><label>NOTES</label><textarea name="notes"></textarea></div><button class="btn primary">Save place</button></form>`,
    expense:`<form id="expenseForm" class="form-grid"><div class="form-row"><label>DATE</label><input name="date" type="date" value="${activeDate(t)}" required></div><div class="form-row"><label>DESCRIPTION</label><input name="title" required placeholder="Dinner — Shabu Shabu"></div><div class="form-row two"><div><label>AMOUNT (${t.baseCurrency})</label><input name="amount" type="number" step=".01" min="0" required></div><div><label>CATEGORY</label><select name="category"><option>Food</option><option>Transport</option><option>Shopping</option><option>Activities</option><option>Accommodation</option><option>Other</option></select></div></div><div class="form-row two"><div><label>PAYMENT</label><select name="payment"><option>Cash</option><option>Card</option><option>IC Card</option><option>Other</option></select></div><div><label>PAID BY</label><select name="paidBy">${t.travelers.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></div></div><div class="form-row"><label>SPLIT</label><select name="split"><option value="personal">Personal / no split</option><option value="equal">Split equally with all travelers</option></select></div><button class="btn primary">Add expense</button></form>`,
    booking:`<form id="bookingForm" class="form-grid"><div class="form-row"><label>TYPE</label><select name="type"><option>Flight</option><option>Hotel</option><option>Train</option><option>Ticket</option><option>Reservation</option><option>Other</option></select></div><div class="form-row"><label>TITLE</label><input name="title" required></div><div class="form-row two"><div><label>DATE</label><input name="date" type="date" value="${t.startDate}" required></div><div><label>TIME</label><input name="time" type="time"></div></div><div class="form-row"><label>CONFIRMATION</label><input name="confirmation"></div><div class="form-row"><label>NOTES</label><textarea name="notes"></textarea></div><button class="btn primary">Save booking</button></form>`,
    packing:`<form id="packingForm" class="form-grid"><div class="form-row"><label>ITEM</label><input name="name" required></div><div class="form-row"><label>CATEGORY</label><select name="category"><option>Essentials</option><option>Clothing</option><option>Toiletries</option><option>Electronics</option><option>Documents</option><option>Other</option></select></div><button class="btn primary">Add item</button></form>`,
    task:`<form id="taskForm" class="form-grid"><div class="form-row"><label>TASK</label><input name="name" required></div><div class="form-row"><label>DETAIL</label><input name="detail"></div><button class="btn primary">Add task</button></form>`,
    memory:`<form id="memoryForm" class="form-grid"><div class="form-row"><label>DATE</label><input name="date" type="date" value="${activeDate(t)}" required></div><div class="form-row"><label>TITLE</label><input name="title"></div><div class="form-row"><label>JOURNAL NOTE</label><textarea name="note"></textarea></div><div class="form-row"><label>PHOTO</label><input id="memoryImage" name="image" type="file" accept="image/*"></div><button class="btn primary">Save memory</button></form>`
  };
  openModal(({activity:"Add Activity",place:"Save Place",expense:"Add Expense",booking:"Add Booking",packing:"Add Packing Item",task:"Add Pre-trip Task",memory:"Add Memory"})[type],forms[type])
}
function newTrip(){openModal("Create Trip",`<form id="tripForm" class="form-grid"><div class="form-row"><label>TRIP NAME</label><input name="title" required placeholder="Seoul 2027"></div><div class="form-row"><label>DESTINATION</label><input name="destination" required></div><div class="form-row two"><div><label>START</label><input name="startDate" type="date" required></div><div><label>END</label><input name="endDate" type="date" required></div></div><div class="form-row two"><div><label>COUNTRY EMOJI</label><input name="countryEmoji" value="✈️"></div><div><label>CURRENCY</label><select name="baseCurrency">${currencyOptions("JPY")}</select></div></div><button class="btn primary">Create trip</button></form>`)}
function editBudget(){const t=trip();openModal("Edit Budget",`<form id="budgetForm" class="form-grid"><div class="form-row"><label>TOTAL TRIP BUDGET (${t.baseCurrency})</label><input name="totalBudget" type="number" min="0" value="${t.totalBudget}"></div><div class="form-row"><label>DAILY BUDGET (${t.baseCurrency})</label><input name="dailyBudget" type="number" min="0" value="${t.dailyBudget}"></div><button class="btn primary">Save budget</button></form>`)}
function invite(){openModal("Invite Traveler",`<form id="travelerForm" class="form-grid"><p class="meta">Build 1 is local-only. This adds the traveler to the trip; real invitations can be connected later.</p><div class="form-row"><label>NAME</label><input name="name" required></div><div class="form-row"><label>EMOJI</label><input name="emoji" value="🙂"></div><button class="btn primary">Add traveler</button></form>`)}

async function imageData(file,max=900,q=.7){
  if(!file)return"";const url=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file)}),img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url});const scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*scale),h=Math.round(img.height*scale),c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);return c.toDataURL("image/jpeg",q)
}
function download(name,text){const blob=new Blob([text],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
function install(){if(installPrompt){installPrompt.prompt();return}notify("On iPhone: Share → Add to Home Screen. On Android/desktop, use your browser's Install option.")}

document.addEventListener("click",e=>{
  const nav=e.target.closest("[data-nav]"),el=e.target.closest("[data-action]");if(nav){state.currentView=nav.dataset.nav;save();render();return}if(!el)return;const a=el.dataset.action;
  if(a==="go-home"){state.currentView="home";save();render()}
  if(a==="open-quick-add")quick()
  if(a==="quick-add-type")quick(el.dataset.type)
  if(a==="new-trip")newTrip()
  if(a==="switch-trip"){state.currentTripId=el.dataset.id;state.currentView="home";save();render()}
  if(a==="set-plan-view"){state.planView=el.dataset.feature;save();render()}
  if(a==="set-spend-view"){state.spendView=el.dataset.feature;save();render()}
  if(a==="set-trip-view"){state.tripView=el.dataset.feature;save();render()}
  if(a==="close-modal"&&(e.target.classList.contains("modal-backdrop")||el.classList.contains("icon-btn")))closeModal()
  if(a==="open-feature"){const f=el.dataset.feature;if(["itinerary","places","bookings","packing","before"].includes(f)){state.currentView="plan";state.planView=f}else{state.currentView="spend";state.spendView=f}save();render()}
  if(a==="show-itinerary-date"){const wrapper=document.querySelector("#itineraryDay");const temp=document.createElement("div");temp.innerHTML=itineraryHTML(el.dataset.date);wrapper.innerHTML=temp.querySelector("#itineraryDay").innerHTML;document.querySelectorAll("[data-action='show-itinerary-date']").forEach(b=>b.classList.toggle("active",b.dataset.date===el.dataset.date))}
  if(a==="delete-item"){if(!confirm("Delete this item?"))return;const c=el.dataset.collection;trip()[c]=trip()[c].filter(x=>x.id!==el.dataset.id);save();render();notify("Deleted")}
  if(a==="toggle-visited"){const p=trip().places.find(x=>x.id===el.dataset.id);if(p)p.visited=!p.visited;save();render()}
  if(a==="vote-place"){const p=trip().places.find(x=>x.id===el.dataset.id);if(p){p.votes||={};p.votes[trip().travelers[0]?.id||"me"]=el.dataset.vote}save();render()}
  if(a==="filter-places"){const c=el.dataset.category,arr=c==="All"?trip().places:trip().places.filter(x=>x.category===c);document.querySelector("#placeList").innerHTML=placeRows(arr);document.querySelectorAll("[data-action='filter-places']").forEach(b=>b.classList.toggle("active",b.dataset.category===c))}
  if(a==="filter-bookings"){const c=el.dataset.category,arr=c==="All"?trip().bookings:trip().bookings.filter(x=>x.type===c);document.querySelector("#bookingList").innerHTML=arr.length?bookingRows(arr):empty("🎟️",`No ${c.toLowerCase()} bookings`,"");document.querySelectorAll("[data-action='filter-bookings']").forEach(b=>b.classList.toggle("active",b.dataset.category===c))}
  if(a==="edit-budget")editBudget()
  if(a==="invite-traveler")invite()
  if(a==="calc-key"){const inp=document.querySelector("#convExpression"),k=el.dataset.key;if(!inp)return;if(k==="C")inp.value="";else inp.value+=k;calculate(false)}
  if(a==="calculate")calculate(true)
  if(a==="save-rates"){const r={...DEFAULT_RATES};Object.keys(r).forEach(c=>{if(c==="JPY")return;const i=document.querySelector(`#rate_${c}`);if(i&&Number(i.value)>0)r[c]=Number(i.value)});localStorage.setItem(RATE_STORE,JSON.stringify(r));notify("Offline rates saved");calculate(false)}
  if(a==="save-trip-info"){const t=trip();t.title=document.querySelector("#infoTitle").value.trim()||t.title;t.destination=document.querySelector("#infoDestination").value.trim()||t.destination;t.startDate=document.querySelector("#infoStart").value||t.startDate;t.endDate=document.querySelector("#infoEnd").value||t.endDate;t.baseCurrency=document.querySelector("#infoCurrency").value;t.homeCurrency=document.querySelector("#infoHomeCurrency").value;save();notify("Trip info saved");render()}
  if(a==="export-data"){download(`ichigo-backup-${isoToday()}.json`,JSON.stringify(state,null,2));notify("Backup exported")}
  if(a==="import-data")document.querySelector("#importFile")?.click()
  if(a==="install-app")install()
  if(a==="reset-demo"&&confirm("Erase all local Ichigo data on this device?")){localStorage.removeItem(STORE);state=clone(initial);save();render();notify("Ichigo reset")}
  if(a==="toggle-online-info")notify(navigator.onLine?"Online. Saved data will also remain available offline.":"Offline mode active. Your saved trip essentials still work.")
})

document.addEventListener("change",e=>{
  const x=e.target;
  if(x.dataset.action==="toggle-pack"){const i=trip().packing.find(y=>y.id===x.dataset.id);if(i)i.done=x.checked;save();render()}
  if(x.dataset.action==="toggle-pretrip"){const i=trip().preTrip.find(y=>y.id===x.dataset.id);if(i)i.done=x.checked;save();render()}
  if(["convFrom","convTo"].includes(x.id))calculate(false)
  if(x.id==="importFile"&&x.files?.[0]){const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.trips)||!d.trips.length)throw Error();state=d;save();render();notify("Backup imported")}catch{alert("That is not a valid Ichigo backup.")}};r.readAsText(x.files[0])}
})
document.addEventListener("input",e=>{
  if(e.target.id==="placeSearch"){const q=e.target.value.toLowerCase(),arr=trip().places.filter(p=>`${p.name} ${p.area} ${p.category} ${p.notes}`.toLowerCase().includes(q));document.querySelector("#placeList").innerHTML=placeRows(arr)}
  if(e.target.id==="convExpression")calculate(false)
})

document.addEventListener("submit",async e=>{
  e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f).entries()),t=trip();
  if(f.id==="activityForm"){t.itinerary.push({id:uuid(),date:d.date,time:d.time||"00:00",title:d.title.trim(),place:d.place.trim(),type:d.type,notes:d.notes.trim()});save();closeModal();state.currentView="plan";state.planView="itinerary";save();render();notify("Activity added")}
  if(f.id==="placeForm"){t.places.push({id:uuid(),name:d.name.trim(),area:d.area.trim(),category:d.category,notes:d.notes.trim(),votes:{},visited:false});save();closeModal();state.currentView="plan";state.planView="places";save();render();notify("Place saved")}
  if(f.id==="expenseForm"){t.expenses.push({id:uuid(),date:d.date,title:d.title.trim(),category:d.category,amount:Number(d.amount),payment:d.payment,paidBy:d.paidBy,participants:d.split==="equal"?t.travelers.map(x=>x.id):[d.paidBy],split:d.split});save();closeModal();state.currentView="spend";state.spendView="expenses";save();render();notify("Expense added")}
  if(f.id==="bookingForm"){t.bookings.push({id:uuid(),type:d.type,title:d.title.trim(),date:d.date,time:d.time,confirmation:d.confirmation.trim(),notes:d.notes.trim(),status:"Saved"});save();closeModal();state.currentView="plan";state.planView="bookings";save();render();notify("Booking saved")}
  if(f.id==="packingForm"){t.packing.push({id:uuid(),category:d.category,name:d.name.trim(),done:false});save();closeModal();state.currentView="plan";state.planView="packing";save();render();notify("Packing item added")}
  if(f.id==="taskForm"){t.preTrip.push({id:uuid(),name:d.name.trim(),detail:d.detail.trim(),done:false});save();closeModal();state.currentView="plan";state.planView="before";save();render();notify("Task added")}
  if(f.id==="memoryForm"){let image="";const file=document.querySelector("#memoryImage")?.files?.[0];if(file){try{image=await imageData(file)}catch{}}t.memories.push({id:uuid(),date:d.date,title:d.title.trim(),note:d.note.trim(),image});try{save()}catch{t.memories.at(-1).image="";save();notify("Storage was full; saved memory without photo.")}closeModal();state.currentView="trip";state.tripView="memories";save();render();notify("Memory saved")}
  if(f.id==="tripForm"){const n={id:uuid(),title:d.title.trim(),destination:d.destination.trim(),cityLabel:d.destination.toUpperCase(),countryEmoji:d.countryEmoji||"✈️",startDate:d.startDate,endDate:d.endDate,baseCurrency:d.baseCurrency,homeCurrency:"PHP",totalBudget:0,dailyBudget:0,travelers:[],itinerary:[],places:[],bookings:[],packing:[],preTrip:[],expenses:[],memories:[]};state.trips.push(n);state.currentTripId=n.id;state.currentView="home";save();closeModal();render();notify("New trip created 🍓")}
  if(f.id==="budgetForm"){t.totalBudget=Number(d.totalBudget||0);t.dailyBudget=Number(d.dailyBudget||0);save();closeModal();render();notify("Budget updated")}
  if(f.id==="travelerForm"){t.travelers.push({id:uuid(),name:d.name.trim(),role:"Member",emoji:d.emoji||"🙂"});save();closeModal();render();notify("Traveler added locally")}
})

function calculate(showToast=false){
  const input=document.querySelector("#convExpression"),a=document.querySelector("#convFrom"),b=document.querySelector("#convTo");if(!input||!a||!b)return;
  try{const original=safeEval(input.value||"0"),result=original*rateBetween(a.value,b.value);document.querySelector("#convOriginal").textContent=money(original,a.value);document.querySelector("#convResult").textContent=money(result,b.value);document.querySelector("#fromCode").textContent=a.value;document.querySelector("#toCode").textContent=b.value;if(showToast)notify(`${money(original,a.value)} = ${money(result,b.value)}`)}
  catch(err){document.querySelector("#convOriginal").textContent="—";document.querySelector("#convResult").textContent="—";if(showToast)notify(err.message)}
}


/* Open PWA shortcuts from manifest.json. */
function applyLaunchShortcut() {
  const shortcut = window.location.hash.replace("#", "").toLowerCase();

  if (shortcut === "today") {
    state.currentView = "today";
  }

  if (shortcut === "expense") {
    state.currentView = "spend";
    state.spendView = "expenses";
    save();
    setTimeout(() => quick("expense"), 50);
  }

  if (shortcut) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

window.addEventListener("online",()=>{updateOnline();notify("Back online")});
window.addEventListener("offline",()=>{updateOnline();notify("Offline mode active")});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;installBtn.hidden=false});
installBtn.addEventListener("click",install);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        "./service-worker.js",
        { updateViaCache: "none" }
      );

      /* Explicitly check for the newest worker after GitHub Pages deploys. */
      registration.update().catch(() => {});
    } catch (error) {
      console.warn("Service worker registration failed:", error);
    }
  });
}

/* Build 2 moves startup to the end of this file. */

/* =====================================================================
   ICHIGO BUILD 2 UPGRADE LAYER
   Adds all 15 feature groups requested after Build 1 while keeping the
   app local-first. Images/files are stored in IndexedDB via db.js.
   ===================================================================== */

const BUILD2_VERSION = "2.0";
const LIVE_RATE_STORE_V2 = "ichigo-live-rates-v2";
const REMINDER_STORE_V2 = "ichigo-task-reminders-v2";
let ichigoMapInstance = null;
let dragActivityId = "";
let dragPointerId = null;
let todayTimer = null;

function dateOffset(iso, days) {
  const d = parseDate(iso);
  if (!d) return "";
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function ensureTripV2(t) {
  if (!t) return t;

  t.cityLabel ||= String(t.destination || "TRIP").toUpperCase();
  t.categoryBudgets ||= {
    Accommodation: Math.round((t.totalBudget || 0) * .30),
    Food: Math.round((t.totalBudget || 0) * .25),
    Transport: Math.round((t.totalBudget || 0) * .15),
    Shopping: Math.round((t.totalBudget || 0) * .15),
    Activities: Math.round((t.totalBudget || 0) * .10),
    Other: Math.round((t.totalBudget || 0) * .05)
  };
  t.coverKey ||= "";
  t.coverLegacy ||= "";
  t.converter ||= { from: t.baseCurrency || "JPY", to: t.homeCurrency || "PHP", history: [], lastLiveUpdate: "" };
  (t.places ||= []).forEach((p, index) => {
    p.priority ||= index < 2 ? "Must go" : index < 4 ? "Want" : "Maybe";
    p.favorite ??= p.priority === "Must go";
    p.openingHours ||= "";
    p.address ||= "";
    p.mapUrl ||= "";
    p.reservationUrl ||= "";
    p.tags ||= [];
    p.lat = Number.isFinite(Number(p.lat)) ? Number(p.lat) : null;
    p.lng = Number.isFinite(Number(p.lng)) ? Number(p.lng) : null;
  });

  const activityCoordinates = {
    "Hasedera Temple": [35.3122, 139.5331],
    "Enoshima": [35.3017, 139.4804]
  };

  (t.itinerary ||= []).forEach((a, index) => {
    a.duration = Number(a.duration || 60);
    a.travelTime = Number(a.travelTime || 0);
    a.flexible ??= false;
    a.order = Number.isFinite(Number(a.order)) ? Number(a.order) : index;
    a.address ||= "";
    a.link ||= "";
    a.bookingId ||= "";
    a.lat = Number.isFinite(Number(a.lat)) ? Number(a.lat) : null;
    a.lng = Number.isFinite(Number(a.lng)) ? Number(a.lng) : null;
    if ((!a.lat || !a.lng) && activityCoordinates[a.title]) [a.lat, a.lng] = activityCoordinates[a.title];
  });

  (t.bookings ||= []).forEach(b => {
    b.endDate ||= "";
    b.endTime ||= "";
    b.address ||= "";
    b.link ||= "";
    b.attachmentKey ||= "";
    b.attachmentName ||= "";
    b.status ||= "Saved";
  });

  (t.packing ||= []).forEach(i => {
    i.quantity = Number(i.quantity || 1);
  });

  (t.preTrip ||= []).forEach((task, index) => {
    task.category ||= ["Documents","Safety","Connectivity","Money","Offline"][index % 5];
    task.priority ||= index < 2 ? "High" : "Medium";
    task.dueDate ||= dateOffset(t.startDate, -(Math.max(2, 30 - index * 3)));
  });

  (t.expenses ||= []).forEach(e => {
    e.merchant ||= e.title || "";
    e.notes ||= "";
    e.receiptKey ||= "";
    e.receiptName ||= "";
  });

  (t.memories ||= []).forEach(m => {
    m.time ||= "";
    m.location ||= "";
    m.lat = Number.isFinite(Number(m.lat)) ? Number(m.lat) : null;
    m.lng = Number.isFinite(Number(m.lng)) ? Number(m.lng) : null;
    m.photoKey ||= "";
    m.placeId ||= "";
  });

  const isJapan = /japan|tokyo|osaka|kyoto|hokkaido|fukuoka|okinawa/i.test(`${t.destination} ${t.title}`);
  t.essentials ||= {
    hotelName: "",
    hotelAddress: "",
    hotelPhone: "",
    insuranceProvider: "",
    insurancePolicy: "",
    insurancePhone: "",
    medicalNotes: "",
    transitNotes: "",
    contacts: [],
    documents: [],
    phrases: isJapan ? clone(window.ICHIGO_DATA?.japanPhrases || []) : []
  };
  t.essentials.contacts ||= [];
  t.essentials.documents ||= [];
  t.essentials.phrases ||= [];
  t.essentials.contacts.forEach(x => x.id ||= uuid());
  t.essentials.documents.forEach(x => x.id ||= uuid());
  t.essentials.phrases.forEach(x => x.id ||= uuid());

  return t;
}

function migrateAllTripsV2() {
  state.trips = (state.trips || []).map(ensureTripV2);
  state.planView ||= "itinerary";
  state.spendView ||= "budget";
  state.tripView ||= "memories";
  state.shelfFilter ||= "all";
  save();
}

/* Override Build 1 trip() so every read is automatically migrated. */
function trip() {
  const t = state.trips.find(x => x.id === state.currentTripId) || state.trips[0];
  return ensureTripV2(t);
}

function currencyOptions(selected) {
  const list = window.ICHIGO_DATA?.currencies || Object.keys(DEFAULT_RATES);
  return list.map(code => `<option value="${code}" ${code===selected?"selected":""}>${code}</option>`).join("");
}

function categoryOptions(selected="") {
  return (window.ICHIGO_DATA?.expenseCategories || []).map(x => `<option ${x.name===selected?"selected":""}>${esc(x.name)}</option>`).join("");
}

function placeCategoryOptions(selected="") {
  return (window.ICHIGO_DATA?.placeCategories || []).map(x => `<option ${x===selected?"selected":""}>${esc(x)}</option>`).join("");
}

function bookingTypeOptions(selected="") {
  return (window.ICHIGO_DATA?.bookingTypes || []).map(x => `<option ${x===selected?"selected":""}>${esc(x)}</option>`).join("");
}

function paymentOptions(selected="") {
  return (window.ICHIGO_DATA?.paymentMethods || []).map(x => `<option ${x===selected?"selected":""}>${esc(x)}</option>`).join("");
}

function minutesFromTime(time) {
  if (!time || !time.includes(":")) return null;
  const [h,m] = time.split(":").map(Number);
  return h * 60 + m;
}

function timeFromMinutes(total) {
  total = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
}

function formatDuration(mins) {
  mins = Number(mins || 0);
  if (!mins) return "";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function mapsSearchUrl(item) {
  if (item.mapUrl) return item.mapUrl;
  if (item.lat && item.lng) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.lat},${item.lng}`)}`;
  const q = [item.name || item.title, item.address, item.area, trip().destination].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function activitySort(a,b) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  const ao = Number(a.order ?? 9999), bo = Number(b.order ?? 9999);
  if (ao !== bo) return ao - bo;
  return (a.time || "99:99").localeCompare(b.time || "99:99");
}

function activitiesOn(date, t=trip()) {
  return t.itinerary.filter(x => x.date === date).sort(activitySort);
}

function renumberDay(date, t=trip()) {
  activitiesOn(date,t).forEach((x,index) => x.order = index);
}

function priorityClass(value="") {
  return value === "Must go" ? "priority-must" : value === "Want" ? "priority-want" : "priority-maybe";
}

function liveRatesV2() {
  try { return JSON.parse(localStorage.getItem(LIVE_RATE_STORE_V2) || "{}"); }
  catch { return {}; }
}

function setLivePairV2(base, quote, rate, date="") {
  const all = liveRatesV2();
  all[`${base}_${quote}`] = { rate:Number(rate), date, savedAt:Date.now() };
  all[`${quote}_${base}`] = { rate:1/Number(rate), date, savedAt:Date.now() };
  localStorage.setItem(LIVE_RATE_STORE_V2, JSON.stringify(all));
}

function rateBetween(a,b,r=rates()) {
  if (a===b) return 1;
  const live = liveRatesV2()[`${a}_${b}`];
  if (live?.rate) return Number(live.rate);
  return (1 / Number(r[a] || 1)) * Number(r[b] || 1);
}

function remainingTripDays(t=trip()) {
  if (status(t)==="completed") return 0;
  if (status(t)==="planning") return daysBetween(t.startDate,t.endDate);
  return Math.max(1, daysBetween(isoToday(), t.endDate));
}

function dueTasks(t=trip()) {
  const today = isoToday();
  return t.preTrip.filter(x => !x.done && x.dueDate && x.dueDate <= today).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
}

function taskPriorityWeight(p) { return p === "High" ? 0 : p === "Medium" ? 1 : 2; }

function tripStageLabel(t) {
  const st = status(t);
  return st === "planning" ? "Upcoming" : st === "active" ? "Ongoing" : "Completed";
}

function fileSlot(key, kind="image", cls="receipt-thumb") {
  if (!key) return `<div class="${cls}"><span class="file-placeholder">${kind==="image"?"🖼️":"📎"}</span></div>`;
  return `<button class="${cls}" data-action="open-file-v2" data-file-key="${key}" data-file-kind="${kind}" aria-label="Open attachment"><span class="file-placeholder">${kind==="image"?"🖼️":"📎"}</span></button>`;
}

async function hydrateFilesV2(root=document) {
  if (!window.IchigoDB) return;
  const slots = [...root.querySelectorAll("[data-file-key]")];
  await Promise.all(slots.map(async el => {
    const key = el.dataset.fileKey;
    if (!key || el.dataset.hydrated === "1") return;
    try {
      const record = await IchigoDB.get(key);
      if (!record) return;
      if (record.mime?.startsWith("image/")) {
        const url = URL.createObjectURL(record.blob);
        const img = document.createElement("img");
        img.src = url;
        img.alt = "";
        img.onload = () => URL.revokeObjectURL(url);
        el.replaceChildren(img);
      } else {
        el.innerHTML = `<span class="file-placeholder">📎</span>`;
      }
      el.dataset.hydrated = "1";
    } catch (err) { console.warn("Could not hydrate local file", err); }
  }));
}

function checkTaskRemindersV2() {
  const items = dueTasks();
  if (!items.length) return;
  const today = isoToday();
  const key = `${REMINDER_STORE_V2}-${trip().id}`;
  if (localStorage.getItem(key) === today) return;
  localStorage.setItem(key, today);

  if (window.Notification?.permission === "granted") {
    try { new Notification("Ichigo 🍓", { body:`${items.length} pre-trip task${items.length===1?" is":"s are"} due.`, icon:"icons/icon-192.png" }); }
    catch {}
  }
}

function afterRenderV2() {
  hydrateFilesV2();
  if (state.currentView === "plan" && state.planView === "map") setTimeout(initIchigoMapV2, 40);
  if (state.currentView === "today") startTodayTimerV2(); else stopTodayTimerV2();
  checkTaskRemindersV2();
}

function render() {
  migrateAllTripsV2();
  document.querySelectorAll(".nav-item").forEach(x => x.classList.toggle("active",x.dataset.nav===state.currentView));
  ({home:renderHome,plan:renderPlan,today:renderToday,spend:renderSpend,together:renderTogether,trip:renderTrip}[state.currentView]||renderHome)();
  updateOnline();
  afterRenderV2();
}

function renderHome() {
  const t=trip(), st=status(t), s=spent(t), pack=t.packing.filter(x=>x.done).length;
  const packPct=t.packing.length?Math.round(pack/t.packing.length*100):0;
  const upcoming=[...t.itinerary].sort(activitySort).find(x => `${x.date} ${x.time||"23:59"}` >= `${isoToday()} 00:00`) || [...t.itinerary].sort(activitySort)[0];
  const due=dueTasks(t);
  const countdown=st==="planning"?`${Math.max(0,daysUntil(t.startDate))} days to go! 🌸`:st==="active"?`DAY ${dayNo(isoToday(),t)} · ${t.cityLabel} 🍓`:`${daysBetween(t.startDate,t.endDate)} days · saved forever 📖`;

  const shelfTrips=state.trips.map(ensureTripV2).filter(x => {
    if(state.shelfFilter==="all")return true;
    return tripStageLabel(x).toLowerCase()===state.shelfFilter;
  });

  main.innerHTML=`
    <section class="hero-card ${t.coverKey?"has-cover":""}">
      ${t.coverKey?`<div class="hero-cover-photo" data-file-key="${t.coverKey}"></div>`:""}
      <div class="hero-content"><h1>${esc(t.title)} ${esc(t.countryEmoji)}</h1><p class="hero-countdown">${countdown}</p><p class="hero-dates">${nice(t.startDate)} – ${nice(t.endDate,{month:"short",day:"numeric",year:"numeric"})}</p></div>
      <div class="hero-progress" style="--progress:${pct(t)}%"><span>${pct(t)}%</span></div>
      <div class="hero-stats">
        <div class="hero-stat"><strong>🗓 ${t.itinerary.length}</strong><small>Plans</small></div>
        <div class="hero-stat"><strong>📍 ${t.places.length}</strong><small>Places</small></div>
        <div class="hero-stat"><strong>🎟 ${t.bookings.length}</strong><small>Bookings</small></div>
        <div class="hero-stat"><strong>💰 ${money(t.totalBudget)}</strong><small>Budget</small></div>
      </div>
    </section>

    ${due.length?`<section class="section"><button class="notice-card danger" style="width:100%;text-align:left" data-action="open-feature" data-feature="before"><span class="notice-icon">⏰</span><span><strong>${due.length} pre-trip task${due.length===1?" is":"s are"} due</strong><p>${esc(due.slice(0,2).map(x=>x.name).join(" · "))}</p></span></button></section>`:""}

    <section class="section"><div class="grid-2">
      <button class="card mini-card" data-action="open-feature" data-feature="itinerary"><h3>Next Up</h3>${upcoming?`<div class="big-number" style="font-size:16px">${nice(upcoming.date,{weekday:"short",month:"short",day:"numeric"})}</div><div class="meta">${esc(upcoming.flexible?"Anytime":upcoming.time)} · ${esc(upcoming.title)}</div>`:`<div class="meta">No plans yet</div>`}</button>
      <button class="card mini-card" data-action="open-feature" data-feature="budget"><h3>Budget</h3><div class="big-number">${money(Math.max(0,t.totalBudget-s))}</div><div class="meta">${remainingTripDays(t)?`${money(Math.max(0,t.totalBudget-s)/remainingTripDays(t))} / day left`:`Trip complete`}</div><div class="progress"><span style="width:${Math.min(100,t.totalBudget?s/t.totalBudget*100:0)}%"></span></div></button>
      <button class="card mini-card" data-action="open-feature" data-feature="bookings"><h3>Bookings</h3><div class="big-number">${t.bookings.length}</div><div class="meta">${t.bookings.filter(x=>x.status==="Confirmed").length} confirmed</div></button>
      <button class="card mini-card" data-action="open-feature" data-feature="packing"><h3>Packing</h3><div class="big-number">${packPct}%</div><div class="meta">${pack}/${t.packing.length} items</div><div class="progress"><span style="width:${packPct}%"></span></div></button>
    </div></section>

    <section class="section"><div class="section-title"><h3>Quick Add</h3></div>
      <div class="quick-grid">
        <button class="quick-btn" data-action="quick-add-type" data-type="activity"><span>🗓️</span><small>Activity</small></button>
        <button class="quick-btn" data-action="quick-add-type" data-type="place"><span>📍</span><small>Place</small></button>
        <button class="quick-btn" data-action="quick-add-type" data-type="expense"><span>💸</span><small>Expense</small></button>
        <button class="quick-btn" data-action="quick-add-type" data-type="booking"><span>🎟️</span><small>Booking</small></button>
        <button class="quick-btn" data-action="quick-add-type" data-type="memory"><span>📸</span><small>Memory</small></button>
      </div>
      <div class="card sweet-banner"><div class="mascot">🍓</div><div><strong>${st==="completed"?"This trip has become a keepsake.":st==="active"?"Today Mode is ready for you.":"Plan it → Live it → Remember it."}</strong><p>${st==="completed"?"Open the scrapbook and recap whenever you want to revisit it.":st==="active"?"Keep Today open while you move around — the essentials are one tap away.":"Build the itinerary now; Ichigo transforms with the trip later."}</p></div></div>
    </section>

    <section class="section"><div class="section-title"><h3>Travel Shelf</h3><button data-action="new-trip">＋ New trip</button></div>
      <div class="chips shelf-filters">${[["all","All"],["upcoming","Upcoming"],["ongoing","Ongoing"],["completed","Completed"]].map(([k,l])=>`<button class="chip ${state.shelfFilter===k?"active":""}" data-action="shelf-filter-v2" data-filter="${k}">${l}</button>`).join("")}</div>
      <div class="travel-shelf">${shelfTrips.length?shelfTrips.map(x=>`
        <button class="card shelf-card-v2" data-action="switch-trip" data-id="${x.id}">
          <div class="shelf-cover">${x.coverKey?`<div class="shelf-cover-photo" data-file-key="${x.coverKey}"></div>`:""}<span class="shelf-flag">${esc(x.countryEmoji||"✈️")}</span><span class="shelf-status">${tripStageLabel(x)}</span></div>
          <div class="shelf-body"><h3>${esc(x.title)}</h3><p>${nice(x.startDate)} – ${nice(x.endDate,{month:"short",day:"numeric",year:"numeric"})} · ${x.places.filter(p=>p.visited).length}/${x.places.length} places · ${x.memories.length} memories</p></div>
        </button>`).join(""):empty("📚","No trips here yet","Create another trip and it will join your travel shelf.")}</div>
    </section>`;
}

function renderPlan() {
  const menu=[
    ["itinerary","🗓️","Itinerary"],["places","📍","Places"],["map","🗺️","Map"],
    ["bookings","🎟️","Bookings"],["packing","🧳","Packing"],["before","✅","Before You Go"],["essentials","🆘","Essentials"]
  ];
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">PLAN</p><h1>Plan your trip</h1><p>${esc(trip().title)}</p></div><button class="btn soft" data-action="open-quick-add">＋ Add</button></div>
  <div class="chips">${menu.map(([k,e,l])=>`<button class="chip ${state.planView===k?"active":""}" data-action="set-plan-view" data-feature="${k}">${e} ${l}</button>`).join("")}</div>
  <section class="section">${planHTML(state.planView)}</section>`;
}

function planHTML(v) {
  return v==="places"?placesHTML():v==="map"?mapHTMLV2():v==="bookings"?bookingsHTML():v==="packing"?packingHTML():v==="before"?beforeHTML():v==="essentials"?essentialsHTMLV2():itineraryHTML(activeDate());
}

function itineraryHTML(date) {
  const t=trip(), items=activitiesOn(date,t);
  const totalDuration=items.reduce((s,x)=>s+Number(x.duration||0),0);
  const travel=items.reduce((s,x)=>s+Number(x.travelTime||0),0);
  return `<div class="section-title"><h3>🗓️ Itinerary</h3><button data-action="quick-add-type" data-type="activity">＋ Activity</button></div>
  <div class="chips">${allDates(t).map(d=>`<button class="chip ${d===date?"active":""}" data-action="show-itinerary-date" data-date="${d}">Day ${dayNo(d,t)} · ${nice(d)}</button>`).join("")}</div>
  <div id="itineraryDay">
    <div class="day-summary"><div><strong>${items.length}</strong><small>activities</small></div><div><strong>${formatDuration(totalDuration)||"—"}</strong><small>planned</small></div><div><strong>${formatDuration(travel)||"—"}</strong><small>travel time</small></div></div>
    ${items.length?`<div data-itinerary-date="${date}">${items.map(i=>activityCardV2(i)).join("")}</div>`:empty("🗓️","Nothing planned yet","Add an activity to this day.","activity")}
  </div>`;
}

function activityCardV2(i) {
  return `<article class="itinerary-card" data-activity-id="${i.id}" data-date="${i.date}">
    <button class="drag-handle" data-action="drag-activity-v2" data-id="${i.id}" aria-label="Drag to reorder">⋮⋮</button>
    <div class="activity-time">${i.flexible?"Anytime":esc(i.time||"—")}</div>
    <div class="activity-main"><h4>${ICON[i.type]||"📍"} ${esc(i.title)}</h4><p>${esc(i.place||i.address||"")}${i.notes?` · ${esc(i.notes)}`:""}</p>
      <div class="activity-meta">${i.duration?`<span class="badge gray">⏱ ${formatDuration(i.duration)}</span>`:""}${i.travelTime?`<span class="badge">🚃 ${formatDuration(i.travelTime)} travel</span>`:""}${i.flexible?`<span class="badge gold">Flexible</span>`:""}</div>
      <div class="activity-actions"><button class="tiny-btn" data-action="edit-activity-v2" data-id="${i.id}">Edit</button><button class="tiny-btn" data-action="duplicate-activity-v2" data-id="${i.id}">Duplicate</button><button class="tiny-btn" data-action="move-activity-v2" data-id="${i.id}">Move</button>${(i.address||i.lat)?`<a class="tiny-btn" href="${esc(mapsSearchUrl(i))}" target="_blank" rel="noopener">Map</a>`:""}<button class="tiny-btn danger" data-action="delete-v2" data-collection="itinerary" data-id="${i.id}">Delete</button></div>
    </div>
  </article>`;
}

function placesHTML() {
  const t=trip(), cats=["All",...new Set(t.places.map(x=>x.category))];
  const must=t.places.filter(x=>x.priority==="Must go").length;
  return `<div class="section-title"><h3>📍 Places</h3><button data-action="quick-add-type" data-type="place">＋ Place</button></div>
  <div class="grid-3" style="margin-bottom:10px"><div class="stat-card"><strong>${t.places.length}</strong><small>Saved</small></div><div class="stat-card"><strong>${must}</strong><small>Must go</small></div><div class="stat-card"><strong>${t.places.filter(x=>x.visited).length}</strong><small>Visited</small></div></div>
  <div class="searchbox"><input id="placeSearch" placeholder="Search places, tags or areas..."></div>
  <div class="chips" style="margin-top:8px">${cats.map((c,i)=>`<button class="chip ${i===0?"active":""}" data-action="filter-places" data-category="${esc(c)}">${esc(c)}</button>`).join("")}</div>
  <div id="placeList" class="list" style="margin-top:10px">${placeRows(t.places)}</div>`;
}

function placeRows(arr) {
  if(!arr.length)return empty("📍","No saved places","Save cafés, restaurants, shops and attractions.","place");
  return [...arr].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||["Must go","Want","Maybe"].indexOf(a.priority)-["Must go","Want","Maybe"].indexOf(b.priority)).map(p=>`
  <div class="list-row">
    <div class="row-icon">${categoryEmoji(p.category)}</div>
    <div class="row-main"><div style="display:flex;align-items:center;gap:5px"><h4>${esc(p.name)}</h4><span class="place-priority ${priorityClass(p.priority)}">${esc(p.priority)}</span></div><p>${esc(p.area||p.address||"")} · ${esc(p.category)} ${p.visited?"· ✓ Visited":""}</p>
      ${p.openingHours?`<p>🕐 ${esc(p.openingHours)}</p>`:""}
      ${p.tags?.length?`<div class="tag-row">${p.tags.map(x=>`<span class="tag">${esc(x)}</span>`).join("")}</div>`:""}
      <div class="vote-group" style="margin-top:7px">${["❤️","👍","😐","👎"].map(v=>`<button class="vote ${Object.values(p.votes||{}).includes(v)?"active":""}" data-action="vote-place" data-id="${p.id}" data-vote="${v}">${v}</button>`).join("")}</div>
    </div>
    <div class="row-trailing"><button class="favorite-star" data-action="favorite-place-v2" data-id="${p.id}" aria-label="Favorite">${p.favorite?"⭐":"☆"}</button><div><button class="tiny-btn" data-action="edit-place-v2" data-id="${p.id}">Edit</button></div><div style="margin-top:5px"><a class="tiny-btn" href="${esc(mapsSearchUrl(p))}" target="_blank" rel="noopener">Map</a></div><div style="margin-top:5px"><button class="tiny-btn" data-action="toggle-visited" data-id="${p.id}">${p.visited?"Visited ✓":"Visited?"}</button></div><div style="margin-top:5px"><button class="tiny-btn danger" data-action="delete-v2" data-collection="places" data-id="${p.id}">Delete</button></div></div>
  </div>`).join("");
}

function mapHTMLV2() {
  const t=trip(), withCoords=t.places.filter(p=>p.lat&&p.lng), noCoords=t.places.filter(p=>!p.lat||!p.lng);
  return `<div class="section-title"><h3>🗺️ Map View</h3><button data-action="locate-me-v2">◎ Locate me</button></div>
  <div class="map-legend"><span class="badge">📍 ${withCoords.length} mapped places</span><span class="badge gray">🍓 Today's itinerary</span></div>
  <div class="map-shell"><div id="ichigoMap"></div>${!navigator.onLine?`<div class="map-overlay-note">You are offline. Saved place details still work, but map tiles may not load until you're online.</div>`:""}</div>
  ${noCoords.length?`<section class="section"><div class="section-title"><h3>Places needing coordinates</h3><span class="meta">${noCoords.length}</span></div><div class="list">${noCoords.slice(0,8).map(p=>`<button class="list-row" style="width:100%;text-align:left" data-action="edit-place-v2" data-id="${p.id}"><span class="row-icon">📌</span><span class="row-main"><h4>${esc(p.name)}</h4><p>Add latitude / longitude to pin it on the Ichigo map.</p></span><span>›</span></button>`).join("")}</div></section>`:""}`;
}

function initIchigoMapV2() {
  const container=document.querySelector("#ichigoMap");
  if(!container)return;
  if(typeof L==="undefined") { container.innerHTML=`<div class="empty"><div class="emoji">🗺️</div><h3>Map library unavailable</h3><p>Your saved places still work. Reconnect to load the interactive map.</p></div>`; return; }
  try { if(ichigoMapInstance){ichigoMapInstance.remove();ichigoMapInstance=null;} } catch {}
  const t=trip(), mapped=t.places.filter(p=>p.lat&&p.lng), day=activeDate(t), todayItems=activitiesOn(day,t).filter(a=>a.lat&&a.lng);
  const fallback=mapped[0]?[mapped[0].lat,mapped[0].lng]:[35.6762,139.6503];
  ichigoMapInstance=L.map(container,{zoomControl:true,attributionControl:true}).setView(fallback,mapped.length?12:10);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(ichigoMapInstance);
  const bounds=[];
  mapped.forEach(p=>{const marker=L.marker([p.lat,p.lng]).addTo(ichigoMapInstance);marker.bindPopup(`<strong>${esc(p.name)}</strong><br>${esc(p.area||p.category)}<br><small>${esc(p.priority)}</small>`);bounds.push([p.lat,p.lng])});
  todayItems.forEach(a=>{const marker=L.circleMarker([a.lat,a.lng],{radius:8,color:"#ff4f78",fillColor:"#ff6f91",fillOpacity:.85}).addTo(ichigoMapInstance);marker.bindPopup(`<strong>🍓 ${esc(a.title)}</strong><br>${esc(a.time||"Anytime")}`);bounds.push([a.lat,a.lng])});
  if(bounds.length>1)ichigoMapInstance.fitBounds(bounds,{padding:[25,25],maxZoom:15});
  setTimeout(()=>ichigoMapInstance?.invalidateSize(),100);
}

function bookingRows(arr) {
  return arr.map(b=>`<div class="list-row">${b.attachmentKey?fileSlot(b.attachmentKey,b.attachmentName?.toLowerCase().endsWith(".pdf")?"file":"image","booking-attachment"):`<div class="row-icon">${bookEmoji(b.type)}</div>`}<div class="row-main"><h4>${esc(b.title)}</h4><p>${nice(b.date,{month:"short",day:"numeric",year:"numeric"})}${b.time?` · ${esc(b.time)}`:""}${b.endDate?` → ${nice(b.endDate)}`:""}</p><p>${esc(b.confirmation||"No confirmation")} ${b.address?`· ${esc(b.address)}`:""}</p></div><div class="row-trailing"><span class="pill">${esc(b.status||"Saved")}</span><div style="margin-top:5px"><button class="tiny-btn" data-action="edit-booking-v2" data-id="${b.id}">Edit</button></div>${b.link?`<div style="margin-top:5px"><a class="tiny-btn" href="${esc(b.link)}" target="_blank" rel="noopener">Open</a></div>`:""}<div style="margin-top:5px"><button class="tiny-btn danger" data-action="delete-v2" data-collection="bookings" data-id="${b.id}">Delete</button></div></div></div>`).join("");
}

function bookingsHTML() {
  const t=trip(), arr=[...t.bookings].sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  return `<div class="section-title"><h3>🎟️ Bookings</h3><button data-action="quick-add-type" data-type="booking">＋ Booking</button></div>
  <div class="chips">${["All",...(window.ICHIGO_DATA?.bookingTypes||[])].map((c,i)=>`<button class="chip ${i===0?"active":""}" data-action="filter-bookings" data-category="${c}">${c}</button>`).join("")}</div>
  <div id="bookingList" class="list" style="margin-top:10px">${arr.length?bookingRows(arr):empty("🎟️","No bookings yet","Keep flights, hotels, trains, tickets and reservations together.","booking")}</div>`;
}

function packingHTML() {
  const t=trip(), cats=[...new Set(t.packing.map(x=>x.category))], done=t.packing.filter(x=>x.done).length, p=t.packing.length?Math.round(done/t.packing.length*100):0;
  return `<div class="section-title"><h3>🧳 Packing</h3><button data-action="quick-add-type" data-type="packing">＋ Item</button></div>
  <div class="btn-row" style="margin-bottom:9px"><button class="btn soft" data-action="packing-templates-v2">Templates</button><button class="btn" data-action="copy-packing-v2">Copy from trip</button><button class="btn" data-action="pack-all-v2" data-mode="${done===t.packing.length&&t.packing.length?"unpack":"pack"}">${done===t.packing.length&&t.packing.length?"Unpack all":"Pack all"}</button></div>
  <div class="card" style="padding:15px"><div style="display:flex;justify-content:space-between"><strong>Overall progress</strong><strong>${p}%</strong></div><div class="progress"><span style="width:${p}%;background:linear-gradient(90deg,#6ab88d,#96d2af)"></span></div></div>
  ${cats.map(c=>`<div class="card" style="padding:13px 15px;margin-top:10px"><div class="section-title"><h3>${esc(c)}</h3><span class="meta">${t.packing.filter(x=>x.category===c&&x.done).length}/${t.packing.filter(x=>x.category===c).length}</span></div>${t.packing.filter(x=>x.category===c).map(i=>`<label class="check-row ${i.done?"done":""}"><input type="checkbox" ${i.done?"checked":""} data-action="toggle-pack" data-id="${i.id}"><span class="check-name">${esc(i.name)}</span><span class="quantity-pill badge gray">×${i.quantity||1}</span><button class="tiny-btn" type="button" data-action="edit-pack-v2" data-id="${i.id}">Edit</button><button class="tiny-btn danger" type="button" data-action="delete-v2" data-collection="packing" data-id="${i.id}">✕</button></label>`).join("")}</div>`).join("")||empty("🧳","Packing list is empty","Use a template or add your first item.","packing")}`;
}

function beforeHTML() {
  const t=trip(), sorted=[...t.preTrip].sort((a,b)=>Number(a.done)-Number(b.done)||(a.dueDate||"9999").localeCompare(b.dueDate||"9999")||taskPriorityWeight(a.priority)-taskPriorityWeight(b.priority));
  const due=dueTasks(t);
  return `<div class="section-title"><h3>✅ Before You Go</h3><button data-action="quick-add-type" data-type="task">＋ Task</button></div>
  <div class="btn-row" style="margin-bottom:9px"><button class="btn soft" data-action="pretrip-template-v2">Add starter checklist</button><button class="btn" data-action="enable-reminders-v2">🔔 Reminders</button></div>
  ${due.length?`<div class="notice-card danger budget-warning"><span class="notice-icon">⏰</span><span><strong>${due.length} task${due.length===1?"":"s"} due or overdue</strong><p>Ichigo checks due tasks whenever the app opens.</p></span></div>`:""}
  <div class="card" style="padding:13px 15px">${sorted.length?sorted.map(i=>`<label class="check-row ${i.done?"done":""}"><input type="checkbox" ${i.done?"checked":""} data-action="toggle-pretrip" data-id="${i.id}"><span><span class="check-name">${esc(i.name)}</span><small style="display:block;color:var(--muted);margin-top:2px">${esc(i.category)} · <span class="priority-${String(i.priority).toLowerCase()}">${esc(i.priority)}</span></small><small class="task-due ${!i.done&&i.dueDate&&i.dueDate<=isoToday()?"task-overdue":""}">${i.dueDate?`Due ${nice(i.dueDate,{month:"short",day:"numeric",year:"numeric"})}`:"No due date"}${i.detail?` · ${esc(i.detail)}`:""}</small></span><button class="tiny-btn" type="button" data-action="edit-task-v2" data-id="${i.id}">Edit</button><button class="tiny-btn danger" type="button" data-action="delete-v2" data-collection="preTrip" data-id="${i.id}">✕</button></label>`).join(""):empty("✅","Nothing here yet","Add a starter checklist or create your own task.","task")}</div>`;
}

function essentialsHTMLV2() {
  const e=trip().essentials;
  return `<div class="section-title"><h3>🆘 Offline Travel Essentials</h3><button data-action="edit-essentials-v2">Edit</button></div>
  <div class="notice-card success"><span class="notice-icon">✈️</span><span><strong>Designed for offline access</strong><p>Hotel, insurance, emergency contacts, documents and saved phrases live with this trip on your device.</p></span></div>
  <div class="essentials-grid" style="margin-top:10px">
    <div class="card essential-card"><div class="section-title"><h3>🏨 Stay</h3>${e.hotelAddress?`<button data-action="copy-text-v2" data-text="${esc(e.hotelAddress)}">Copy address</button>`:""}</div><div class="essential-value"><strong>${esc(e.hotelName||"No hotel saved")}</strong>${e.hotelAddress?`\n${esc(e.hotelAddress)}`:""}${e.hotelPhone?`\n☎ ${esc(e.hotelPhone)}`:""}</div></div>
    <div class="card essential-card"><h3>🛡️ Insurance</h3><div class="essential-value"><strong>${esc(e.insuranceProvider||"No insurance saved")}</strong>${e.insurancePolicy?`\nPolicy: ${esc(e.insurancePolicy)}`:""}${e.insurancePhone?`\n☎ ${esc(e.insurancePhone)}`:""}</div></div>
    <div class="card essential-card"><h3>🩺 Medical / safety notes</h3><div class="essential-value">${esc(e.medicalNotes||"No notes saved")}</div></div>
    <div class="card essential-card"><h3>🚃 Transport notes</h3><div class="essential-value">${esc(e.transitNotes||"No notes saved")}</div></div>
  </div>
  <section class="section"><div class="section-title"><h3>Emergency contacts</h3><button data-action="add-contact-v2">＋ Contact</button></div><div class="card" style="padding:8px 13px">${e.contacts.length?e.contacts.map(c=>`<div class="contact-row"><div class="row-icon">☎️</div><div class="row-main"><h4>${esc(c.name)}</h4><p>${esc(c.phone)} ${c.note?`· ${esc(c.note)}`:""}</p></div><button class="tiny-btn danger" data-action="delete-essential-v2" data-kind="contacts" data-id="${c.id}">✕</button></div>`).join(""):`<div class="empty"><p>Add family, insurance or other important contacts.</p></div>`}</div></section>
  <section class="section"><div class="section-title"><h3>Document references</h3><button data-action="add-document-v2">＋ Document</button></div><div class="list">${e.documents.length?e.documents.map(d=>`<div class="list-row"><div class="row-icon">📄</div><div class="row-main"><h4>${esc(d.name)}</h4><p>${esc(d.reference||d.note||"")}</p></div><button class="tiny-btn danger" data-action="delete-essential-v2" data-kind="documents" data-id="${d.id}">✕</button></div>`).join(""):`<div class="card empty"><p>Save reference numbers or notes — avoid storing full sensitive document numbers unless you are comfortable keeping them on this device.</p></div>`}</div></section>
  <section class="section"><div class="section-title"><h3>Useful phrases</h3><button data-action="add-phrase-v2">＋ Phrase</button></div><div class="list">${e.phrases.length?e.phrases.map(p=>`<button class="phrase-card" style="text-align:left" data-action="copy-text-v2" data-text="${esc(p.jp)}"><div class="jp">${esc(p.jp)}</div><div class="romaji">${esc(p.romaji||"")}</div><div class="translation">${esc(p.en||"")}</div></button>`).join(""):`<div class="card empty"><p>Add survival phrases you want available offline.</p></div>`}</div></section>`;
}

function renderSpend() {
  const menu=[["budget","💰","Budget"],["expenses","🧾","Expenses"],["converter","💱","Converter"],["split","💸","Split"]];
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">SPEND</p><h1>Trip money</h1><p>${esc(trip().title)}</p></div><button class="btn soft" data-action="quick-add-type" data-type="expense">＋ Expense</button></div><div class="chips">${menu.map(([k,e,l])=>`<button class="chip ${state.spendView===k?"active":""}" data-action="set-spend-view" data-feature="${k}">${e} ${l}</button>`).join("")}</div><section class="section">${spendHTML(state.spendView)}</section>`;
}

function spendHTML(v) { return v==="expenses"?expensesHTML():v==="converter"?converterHTML():v==="split"?splitHTML():budgetHTML(); }

function budgetHTML() {
  const t=trip(), s=spent(t), remain=Math.max(0,t.totalBudget-s), categories=window.ICHIGO_DATA?.expenseCategories||[];
  const overTotal=t.totalBudget>0&&s>t.totalBudget;
  const categoryWarnings=categories.filter(c=>{const cap=Number(t.categoryBudgets[c.name]||0);const used=t.expenses.filter(e=>normCat(e.category)===c.name).reduce((a,b)=>a+Number(b.amount),0);return cap>0&&used>cap});
  return `<div class="section-title"><h3>💰 Budget</h3><button data-action="edit-budget">Edit budget</button></div>
  ${overTotal?`<div class="notice-card danger budget-warning"><span class="notice-icon">⚠️</span><span><strong>Trip budget exceeded</strong><p>You are ${money(s-t.totalBudget)} over your total budget.</p></span></div>`:""}
  ${categoryWarnings.length?`<div class="notice-card budget-warning"><span class="notice-icon">💡</span><span><strong>${categoryWarnings.length} category budget${categoryWarnings.length===1?"":"s"} exceeded</strong><p>${esc(categoryWarnings.map(x=>x.name).join(" · "))}</p></span></div>`:""}
  <div class="card" style="padding:17px"><p class="meta">Total Budget</p><div class="big-number">${money(t.totalBudget)}</div><div class="progress"><span style="width:${Math.min(100,t.totalBudget?s/t.totalBudget*100:0)}%"></span></div><div class="grid-3" style="margin-top:14px"><div><span class="meta">Remaining</span><div style="font-weight:800">${money(remain)}</div></div><div><span class="meta">Spent</span><div style="font-weight:800">${money(s)}</div></div><div><span class="meta">Per day left</span><div style="font-weight:800">${remainingTripDays(t)?money(remain/remainingTripDays(t)):money(0)}</div></div></div></div>
  <div class="card" style="padding:15px;margin-top:10px"><div class="section-title"><h3>Category budgets</h3></div>${categories.map(c=>{const used=t.expenses.filter(e=>normCat(e.category)===c.name).reduce((a,b)=>a+Number(b.amount),0),cap=Number(t.categoryBudgets[c.name]||0),p=cap?used/cap*100:0;return `<div class="budget-category"><span>${c.icon}</span><div><strong>${esc(c.name)}</strong><div class="progress"><span style="width:${Math.min(100,p)}%"></span></div></div><small class="${cap&&used>cap?"task-overdue":""}">${money(used)} / ${money(cap)}</small></div>`}).join("")}</div>
  <div class="card" style="padding:15px;margin-top:10px"><div class="section-title"><h3>Daily breakdown</h3><span class="meta">${money(t.dailyBudget)} target/day</span></div>${allDates(t).map(d=>{const v=spentDate(d,t),p=t.dailyBudget?v/t.dailyBudget*100:0;return `<div class="daily-budget-row"><strong>Day ${dayNo(d,t)}<br><small>${nice(d)}</small></strong><div class="progress"><span style="width:${Math.min(100,p)}%"></span></div><small class="${t.dailyBudget&&v>t.dailyBudget?"task-overdue":""}">${money(v)}</small></div>`}).join("")}</div>`;
}

function expensesHTML() {
  const t=trip(), arr=[...t.expenses].sort((a,b)=>`${b.date}${b.createdAt||0}`.localeCompare(`${a.date}${a.createdAt||0}`));
  return `<div class="section-title"><h3>🧾 Expenses</h3><button data-action="quick-add-type" data-type="expense">＋ Expense</button></div>
  <div class="card" style="padding:16px;margin-bottom:10px"><div class="meta">Total spent</div><div class="big-number">${money(spent(t))}</div><div class="meta">${t.expenses.length} expense${t.expenses.length===1?"":"s"} · receipts stay on this device</div></div>
  <div class="list">${arr.length?arr.map(e=>`<div class="list-row">${e.receiptKey?fileSlot(e.receiptKey,"image","receipt-thumb"):`<div class="row-icon">${expenseEmoji(e.category)}</div>`}<div class="row-main"><h4>${esc(e.merchant||e.title)}</h4><p>${nice(e.date)} · ${esc(e.category)} · ${esc(e.payment||"Other")}</p>${e.notes?`<p>${esc(e.notes)}</p>`:""}${e.split==="equal"?`<p>Paid by ${traveler(e.paidBy)} · split with ${e.participants.length}</p>`:""}</div><div class="row-trailing"><strong>${money(e.amount)}</strong><div style="margin-top:5px"><button class="tiny-btn" data-action="edit-expense-v2" data-id="${e.id}">Edit</button></div><div style="margin-top:5px"><button class="tiny-btn danger" data-action="delete-v2" data-collection="expenses" data-id="${e.id}">Delete</button></div></div></div>`).join(""):empty("🧾","No expenses yet","Track spending, payment method and receipt photos.","expense")}</div>`;
}

function converterHTML() {
  const t=trip(), from=t.converter.from||t.baseCurrency, to=t.converter.to||t.homeCurrency, pair=liveRatesV2()[`${from}_${to}`], history=(t.converter.history||[]).slice(0,8);
  const initial=6420;
  return `<div class="section-title"><h3>💱 Converter</h3><button data-action="swap-currency-v2">⇅ Swap</button></div><div class="card converter-card">
  <div class="form-row two"><div><label>FROM</label><select id="convFrom">${currencyOptions(from)}</select></div><div><label>TO</label><select id="convTo">${currencyOptions(to)}</select></div></div>
  <div class="rate-status"><small>${pair?`Live rate saved ${pair.date?`for ${esc(pair.date)}`:""} · works offline now`:`Using your saved offline fallback rate`}</small><button class="tiny-btn primary" data-action="refresh-live-rate-v2">↻ Live rate</button></div>
  <input id="convExpression" class="calc-input" value="${initial}" inputmode="decimal" placeholder="5+89+678">
  <div class="currency-box"><div class="currency-head"><span class="currency-code" id="fromCode">${from}</span><small class="meta">Original total</small></div><div class="currency-amount" id="convOriginal">${money(initial,from)}</div></div><div style="text-align:center;margin:7px">⇅</div>
  <div class="currency-box"><div class="currency-head"><span class="currency-code" id="toCode">${to}</span><small class="meta">Converted</small></div><div class="currency-amount" id="convResult">${money(initial*rateBetween(from,to),to)}</div></div>
  <div class="keypad">${["7","8","9","÷","4","5","6","×","1","2","3","−","C","0",".","+"].map(k=>`<button class="key ${["÷","×","−","+"].includes(k)?"op":""}" data-action="calc-key" data-key="${k}">${k}</button>`).join("")}</div><button class="key equal" style="width:100%;margin-top:8px" data-action="calculate">= Convert</button>
  <details style="margin-top:12px"><summary class="meta">Edit fallback offline rates</summary><div class="form-grid" style="margin-top:10px">${["PHP","USD","GBP","EUR","SGD","HKD","CNY"].map(c=>`<div class="form-row two"><label>1 JPY → ${c}</label><input id="rate_${c}" type="number" step="any" value="${rates()[c]}"></div>`).join("")}<button class="btn soft" data-action="save-rates">Save fallback rates</button></div></details>
  ${history.length?`<div class="section-title" style="margin-top:14px"><h3>Recent conversions</h3><button data-action="clear-converter-history-v2">Clear</button></div><div class="converter-history">${history.map(h=>`<div class="history-row"><span>${esc(h.expression)} · ${h.from}→${h.to}</span><strong>${money(h.result,h.to)}</strong></div>`).join("")}</div>`:""}
  </div>`;
}

function calculate(showToast=false) {
  const input=document.querySelector("#convExpression"), a=document.querySelector("#convFrom"), b=document.querySelector("#convTo"); if(!input||!a||!b)return;
  try {
    const original=safeEval(input.value||"0"), result=original*rateBetween(a.value,b.value), t=trip();
    t.converter.from=a.value; t.converter.to=b.value;
    document.querySelector("#convOriginal").textContent=money(original,a.value); document.querySelector("#convResult").textContent=money(result,b.value); document.querySelector("#fromCode").textContent=a.value; document.querySelector("#toCode").textContent=b.value;
    save();
    if(showToast){t.converter.history.unshift({id:uuid(),at:Date.now(),expression:input.value,from:a.value,to:b.value,original,result});t.converter.history=t.converter.history.slice(0,20);save();notify(`${money(original,a.value)} = ${money(result,b.value)}`)}
  } catch(err) { document.querySelector("#convOriginal").textContent="—";document.querySelector("#convResult").textContent="—";if(showToast)notify(err.message); }
}

function timelineStateV2(date,t=trip()) {
  const items=activitiesOn(date,t);
  if(!items.length)return {current:null,next:null,countdown:"Free time"};
  if(status(t)!=="active"||date!==isoToday())return {current:null,next:items[0],countdown:`Next at ${items[0].flexible?"anytime":items[0].time}`};
  const now=new Date(), nowMin=now.getHours()*60+now.getMinutes();
  let current=null,next=null;
  for(const item of items){
    if(item.flexible)continue;
    const start=minutesFromTime(item.time);if(start===null)continue;
    const end=start+Number(item.duration||60);
    if(nowMin>=start&&nowMin<end){current=item;break}
    if(start>nowMin&&!next)next=item;
  }
  if(!current&&!next) next=items.find(x=>x.flexible)||null;
  let countdown="You're free for now";
  const focus=next||current;
  if(current){const end=minutesFromTime(current.time)+Number(current.duration||60);const diff=end-nowMin;countdown=diff>0?`${formatDuration(diff)} left`:`Happening now`;}
  else if(next&&!next.flexible){const diff=minutesFromTime(next.time)-nowMin;countdown=diff>0?`In ${formatDuration(diff)}`:"Up next";}
  else if(next?.flexible)countdown="Flexible — anytime today";
  return {current,next,countdown};
}

function renderToday() {
  const t=trip(), d=activeDate(t), items=activitiesOn(d,t), todaySpent=spentDate(d,t), flow=timelineStateV2(d,t);
  const focus=flow.current||flow.next;
  const bookings=t.bookings.filter(b=>b.date===d).sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99"));
  const notes=items.filter(x=>x.notes).map(x=>`${x.time||""} ${x.title}: ${x.notes}`).slice(0,4);
  main.innerHTML=`<section class="today-header"><p class="eyebrow" style="color:#8b3044!important">${esc(t.cityLabel||t.destination)} · DAY ${dayNo(d,t)}</p><h1>${nice(d,{weekday:"long",month:"long",day:"numeric"})}</h1><p>${status(t)==="active"?"Your live travel day":"Previewing Today Mode"}</p></section>
  ${focus?`<section class="card today-focus"><span class="badge ${flow.current?"green":""}">${flow.current?"HAPPENING NOW":"UP NEXT"}</span><div class="countdown">${esc(flow.countdown)}</div><h3>${ICON[focus.type]||"📍"} ${esc(focus.title)}</h3><p>${esc(focus.time||"Anytime")} · ${esc(focus.place||focus.address||"")}${focus.travelTime?` · ${formatDuration(focus.travelTime)} travel`:""}</p>${focus.notes?`<p>📝 ${esc(focus.notes)}</p>`:""}</section>`:""}
  ${items.length?`<section class="card" style="padding:16px;margin-top:12px"><div class="timeline">${items.map(i=>`<div class="timeline-item"><div class="timeline-time">${i.flexible?"Anytime":esc(i.time)}</div><div class="timeline-dot"></div><div class="timeline-content"><strong>${ICON[i.type]||"📍"} ${esc(i.title)}</strong><small>${esc(i.place)}${i.duration?` · ${formatDuration(i.duration)}`:""}</small></div></div>`).join("")}</div></section>`:empty("🌸","Your day is still open","Add activities to see them here.","activity")}
  <section class="card" style="padding:16px;margin-top:12px;background:linear-gradient(145deg,#fff,#fff0f3)"><div class="section-title"><h3>Today's spending</h3><span>${money(todaySpent)} / ${money(t.dailyBudget)}</span></div><div class="progress"><span style="width:${Math.min(100,t.dailyBudget?todaySpent/t.dailyBudget*100:0)}%"></span></div>${t.dailyBudget&&todaySpent>t.dailyBudget?`<p class="task-overdue" style="font-size:9px;margin-bottom:0">${money(todaySpent-t.dailyBudget)} over today's target</p>`:""}</section>
  ${bookings.length?`<section class="section"><div class="section-title"><h3>🎟 Today's bookings</h3></div><div class="list">${bookingRows(bookings)}</div></section>`:""}
  ${notes.length?`<section class="section"><div class="section-title"><h3>📝 Important notes</h3></div><div class="today-note-list">${notes.map(n=>`<div class="today-note">${esc(n)}</div>`).join("")}</div></section>`:""}
  <section class="section"><div class="grid-3"><button class="btn soft" data-action="quick-add-type" data-type="expense">＋ Expense</button><button class="btn soft" data-action="open-feature" data-feature="converter">💱 Convert</button><button class="btn soft" data-action="open-feature" data-feature="places">📍 Places</button></div><div class="grid-3" style="margin-top:8px"><button class="btn" data-action="open-feature" data-feature="bookings">🎟 Booking</button><button class="btn" data-action="today-essentials-v2">🆘 Essentials</button><button class="btn" data-action="quick-add-type" data-type="memory">📸 Memory</button></div></section>
  <section class="card sweet-banner"><div class="mascot">${navigator.onLine?"📶":"✈️"}</div><div><strong>${navigator.onLine?"You're online.":"Offline mode is working."}</strong><p>Saved itinerary, bookings, expenses, essential information and the last saved currency rate stay available locally.</p></div></section>`;
}

function startTodayTimerV2(){stopTodayTimerV2();todayTimer=setInterval(()=>{if(state.currentView==="today")renderToday()},60000)}
function stopTodayTimerV2(){if(todayTimer){clearInterval(todayTimer);todayTimer=null}}

function renderTrip() {
  const menu=[["memories","📸","Journal"],["scrapbook","📖","Scrapbook"],["recap","📊","Trip Recap"],["info","ℹ️","Trip Info"],["settings","⚙️","Settings"]];
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">TRIP</p><h1>${esc(trip().title)}</h1><p>Your trip story and settings</p></div></div><div class="chips">${menu.map(([k,e,l])=>`<button class="chip ${state.tripView===k?"active":""}" data-action="set-trip-view" data-feature="${k}">${e} ${l}</button>`).join("")}</div><section class="section">${tripHTML(state.tripView)}</section>`;
}

function tripHTML(v) { return v==="scrapbook"?scrapbookHTMLV2():v==="recap"?recapHTML():v==="info"?infoHTML():v==="settings"?settingsHTML():memoriesHTML(); }

function memoriesHTML() {
  const t=trip(), arr=[...t.memories].sort((a,b)=>`${b.date}${b.time||""}`.localeCompare(`${a.date}${a.time||""}`));
  return `<div class="section-title"><h3>📸 Travel Journal</h3><button data-action="quick-add-type" data-type="memory">＋ Memory</button></div>
  ${arr.length?`<div class="grid-2">${arr.map(m=>`<article class="card memory-card">${m.photoKey?`<button class="memory-photo" data-action="open-file-v2" data-file-key="${m.photoKey}" data-file-kind="image"><span class="file-placeholder">📸</span></button>`:m.image?`<img class="memory-photo" src="${m.image}" alt="">`:`<div class="memory-photo" style="display:grid;place-items:center;font-size:35px">📸</div>`}<div class="memory-body"><h4>${esc(m.title||"Little memory")}</h4><p>${esc(m.note||"")}</p><div class="journal-location">🗓 ${nice(m.date)}${m.time?` · ${esc(m.time)}`:""}${m.location?` · 📍 ${esc(m.location)}`:""}</div><div class="activity-actions"><button class="tiny-btn" data-action="edit-memory-v2" data-id="${m.id}">Edit</button><button class="tiny-btn danger" data-action="delete-v2" data-collection="memories" data-id="${m.id}">Delete</button></div></div></article>`).join("")}</div>`:empty("📸","Your travel journal starts here","Add a photo, location and a tiny note during the trip.","memory")}`;
}

function scrapbookHTMLV2() {
  const t=trip();
  const days=allDates(t).filter(d=>activitiesOn(d,t).length||t.memories.some(m=>m.date===d)||t.expenses.some(e=>e.date===d));
  return `<div class="section-title"><h3>📖 Automatic Scrapbook</h3><span class="meta">built from your trip data</span></div>
  ${days.length?days.map(d=>{const plans=activitiesOn(d,t),mem=t.memories.filter(m=>m.date===d),daySpend=spentDate(d,t),visited=t.places.filter(p=>p.visited&&plans.some(a=>a.title.includes(p.name)||a.place?.includes(p.name)));return `<section class="scrapbook-day"><div class="scrapbook-head"><h3>DAY ${dayNo(d,t)} · ${nice(d,{weekday:"short",month:"short",day:"numeric"})}</h3><span class="badge gray">${money(daySpend)}</span></div><div class="card scrapbook-timeline"><p class="meta">${plans.length?plans.map(p=>`${p.time||""} ${esc(p.title)}`).join(" · "):"A free day"}</p>${visited.length?`<p class="meta">📍 Visited: ${visited.map(p=>esc(p.name)).join(" · ")}</p>`:""}${mem.length?`<div class="scrapbook-memory-grid">${mem.map(m=>m.photoKey?`<button class="memory-tile" data-action="open-file-v2" data-file-key="${m.photoKey}" data-file-kind="image"><span>📸</span></button>`:m.image?`<img src="${m.image}" alt="">`:`<div class="memory-tile"><span>📸</span></div>`).join("")}</div><div style="margin-top:9px">${mem.filter(m=>m.note).map(m=>`<div class="today-note">${esc(m.note)}</div>`).join("")}</div>`:""}</div></section>`}).join(""):empty("📖","Your scrapbook will build itself","As you add itinerary items, expenses and memories, each day becomes a little story.")}`;
}

function recapHTML() {
  const t=trip(), s=spent(t), visited=t.places.filter(x=>x.visited).length, food=t.expenses.filter(x=>normCat(x.category)==="Food").length, trans=t.expenses.filter(x=>normCat(x.category)==="Transport").length;
  const cats=window.ICHIGO_DATA?.expenseCategories||[], maxCat=Math.max(1,...cats.map(c=>t.expenses.filter(e=>normCat(e.category)===c.name).reduce((a,b)=>a+Number(b.amount),0)));
  return `<div class="card recap-hero"><p class="eyebrow">YOUR TRIP STORY</p><h2 style="margin:0">${esc(t.countryEmoji)} ${esc(t.title)}</h2><p class="meta">${nice(t.startDate)} – ${nice(t.endDate,{month:"short",day:"numeric",year:"numeric"})}</p><div class="big-number">${money(s)} spent</div><div class="stats-grid"><div class="stat-card"><strong>${daysBetween(t.startDate,t.endDate)}</strong><small>Days</small></div><div class="stat-card"><strong>${visited}</strong><small>Places visited</small></div><div class="stat-card"><strong>${t.memories.length}</strong><small>Memories</small></div><div class="stat-card"><strong>${food}</strong><small>Food entries</small></div><div class="stat-card"><strong>${trans}</strong><small>Transit entries</small></div><div class="stat-card"><strong>${t.itinerary.length}</strong><small>Plans</small></div></div></div>
  <div class="card" style="padding:15px;margin-top:10px"><div class="section-title"><h3>Where the money went</h3></div><div class="recap-chart">${cats.map(c=>{const v=t.expenses.filter(e=>normCat(e.category)===c.name).reduce((a,b)=>a+Number(b.amount),0);return `<div class="recap-bar"><span>${c.icon} ${esc(c.name)}</span><div class="bar"><i style="width:${v/maxCat*100}%"></i></div><small>${money(v)}</small></div>`}).join("")}</div></div>
  <div class="card" style="padding:15px;margin-top:10px"><div class="section-title"><h3>Trip favorites</h3></div><p class="meta">⭐ ${t.places.filter(p=>p.favorite).map(p=>esc(p.name)).join(" · ")||"Favorite some places to see them here."}</p></div>`;
}

function infoHTML() {
  const t=trip();
  return `<div class="card" style="padding:16px"><div class="form-grid"><div class="form-row"><label>TRIP NAME</label><input id="infoTitle" value="${esc(t.title)}"></div><div class="form-row"><label>DESTINATION</label><input id="infoDestination" value="${esc(t.destination)}"></div><div class="form-row two"><div><label>START</label><input id="infoStart" type="date" value="${t.startDate}"></div><div><label>END</label><input id="infoEnd" type="date" value="${t.endDate}"></div></div><div class="form-row two"><div><label>BASE CURRENCY</label><select id="infoCurrency">${currencyOptions(t.baseCurrency)}</select></div><div><label>HOME CURRENCY</label><select id="infoHomeCurrency">${currencyOptions(t.homeCurrency)}</select></div></div><button class="btn primary" data-action="save-trip-info">Save trip info</button></div></div>
  <div class="card" style="padding:16px;margin-top:10px"><div class="section-title"><h3>Trip cover</h3><span class="meta">used on your Travel Shelf</span></div>${t.coverKey?`<div class="shelf-cover" style="border-radius:17px;margin-bottom:9px"><div class="shelf-cover-photo" data-file-key="${t.coverKey}"></div></div>`:""}<input id="tripCoverInputV2" type="file" accept="image/*"><button class="btn soft full" style="margin-top:8px" data-action="save-cover-v2">Save cover photo</button></div>`;
}

function settingsHTML() {
  return `<div class="card" style="padding:16px"><div class="section-title"><h3>Local data</h3></div><p class="meta">Build 2 keeps structured trip data in localStorage and photos / attachments in IndexedDB. Your app still has no account or server dependency.</p><div class="btn-row" style="margin-top:12px"><button class="btn soft" data-action="export-data">Export JSON data</button><button class="btn" data-action="import-data">Import JSON data</button></div><input id="importFile" type="file" accept="application/json" hidden><p class="inline-help">The JSON backup contains trip records but not the separate IndexedDB photo/attachment blobs.</p><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><div class="section-title"><h3>PWA / offline</h3></div><p class="meta">Core screens and local trip information are cached. Online map tiles and live exchange-rate refresh need a connection.</p><button class="btn soft" data-action="install-app">Install Ichigo</button><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><button class="btn danger full" data-action="reset-demo">Reset all local data</button></div>`;
}

function activityFormHTMLV2(item={}) {
  const t=trip();
  return `<form id="activityFormV2" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row"><label>DATE</label><input name="date" type="date" value="${item.date||activeDate(t)}" required></div>
    <div class="form-row two"><div><label>TIME</label><input name="time" type="time" value="${item.time||""}"></div><div><label>DURATION (MIN)</label><input name="duration" type="number" min="0" step="5" value="${item.duration||60}"></div></div>
    <div class="form-row two"><div><label>TRAVEL TIME BEFORE (MIN)</label><input name="travelTime" type="number" min="0" step="5" value="${item.travelTime||0}"></div><div><label>TYPE</label><select name="type">${[["place","Place"],["cafe","Café"],["food","Food"],["transport","Transport"],["attraction","Attraction"],["shopping","Shopping"]].map(([v,l])=>`<option value="${v}" ${item.type===v?"selected":""}>${l}</option>`).join("")}</select></div></div>
    <div class="switch-row"><span><strong style="font-size:11px">Flexible / anytime</strong><small class="inline-help">Use this when the activity has no fixed time.</small></span><label class="switch"><input name="flexible" type="checkbox" ${item.flexible?"checked":""}><span></span></label></div>
    <div class="form-row"><label>ACTIVITY</label><input name="title" required value="${esc(item.title||"")}" placeholder="Hasedera Temple"></div>
    <div class="form-row"><label>PLACE / AREA</label><input name="place" value="${esc(item.place||"")}" placeholder="Kamakura"></div>
    <div class="form-row"><label>ADDRESS</label><input name="address" value="${esc(item.address||"")}" placeholder="Optional"></div>
    <div class="form-row two"><div><label>LATITUDE</label><input name="lat" type="number" step="any" value="${item.lat??""}"></div><div><label>LONGITUDE</label><input name="lng" type="number" step="any" value="${item.lng??""}"></div></div>
    <div class="form-row"><label>NOTES</label><textarea name="notes">${esc(item.notes||"")}</textarea></div>
    <button class="btn primary">${item.id?"Save activity":"Add to itinerary"}</button>
  </form>`;
}

function placeFormHTMLV2(item={}) {
  return `<form id="placeFormV2" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row"><label>PLACE NAME</label><input name="name" required value="${esc(item.name||"")}" placeholder="Pokémon Café"></div>
    <div class="form-row two"><div><label>AREA</label><input name="area" value="${esc(item.area||"")}" placeholder="Nihonbashi"></div><div><label>CATEGORY</label><select name="category">${placeCategoryOptions(item.category||"Café")}</select></div></div>
    <div class="form-row two"><div><label>PRIORITY</label><select name="priority">${["Must go","Want","Maybe"].map(x=>`<option ${item.priority===x?"selected":""}>${x}</option>`).join("")}</select></div><div><label>OPENING HOURS</label><input name="openingHours" value="${esc(item.openingHours||"")}" placeholder="10:00–20:00"></div></div>
    <div class="switch-row"><span><strong style="font-size:11px">Favorite</strong></span><label class="switch"><input name="favorite" type="checkbox" ${item.favorite?"checked":""}><span></span></label></div>
    <div class="form-row"><label>ADDRESS</label><input name="address" value="${esc(item.address||"")}"></div>
    <div class="form-row two"><div><label>LATITUDE</label><input name="lat" type="number" step="any" value="${item.lat??""}"></div><div><label>LONGITUDE</label><input name="lng" type="number" step="any" value="${item.lng??""}"></div></div>
    <button class="btn soft" type="button" data-action="fill-current-location-v2" data-target-form="placeFormV2">◎ Use my current coordinates</button>
    <div class="form-row"><label>MAP LINK</label><input name="mapUrl" type="url" value="${esc(item.mapUrl||"")}" placeholder="Optional Google/Apple Maps link"></div>
    <div class="form-row"><label>RESERVATION LINK</label><input name="reservationUrl" type="url" value="${esc(item.reservationUrl||"")}"></div>
    <div class="form-row"><label>TAGS</label><input name="tags" value="${esc((item.tags||[]).join(", "))}" placeholder="ramen, rainy day, shinjuku"></div>
    <div class="form-row"><label>NOTES</label><textarea name="notes">${esc(item.notes||"")}</textarea></div>
    <button class="btn primary">${item.id?"Save place":"Save place"}</button>
  </form>`;
}

function expenseFormHTMLV2(item={}) {
  const t=trip();
  return `<form id="expenseFormV2" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row"><label>DATE</label><input name="date" type="date" value="${item.date||activeDate(t)}" required></div>
    <div class="form-row"><label>MERCHANT / DESCRIPTION</label><input name="merchant" required value="${esc(item.merchant||item.title||"")}" placeholder="Dinner — Shabu Shabu"></div>
    <div class="form-row two"><div><label>AMOUNT (${t.baseCurrency})</label><input name="amount" type="number" step=".01" min="0" value="${item.amount??""}" required></div><div><label>CATEGORY</label><select name="category">${categoryOptions(item.category||"Food")}</select></div></div>
    <div class="form-row two"><div><label>PAYMENT</label><select name="payment">${paymentOptions(item.payment||"Cash")}</select></div><div><label>PAID BY</label><select name="paidBy">${t.travelers.map(x=>`<option value="${x.id}" ${item.paidBy===x.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select></div></div>
    <div class="form-row"><label>SPLIT</label><select name="split"><option value="personal" ${item.split!=="equal"?"selected":""}>Personal / no split</option><option value="equal" ${item.split==="equal"?"selected":""}>Split equally with all travelers</option></select></div>
    <div class="form-row"><label>NOTES</label><textarea name="notes">${esc(item.notes||"")}</textarea></div>
    <div class="form-row"><label>RECEIPT PHOTO</label><input name="receipt" type="file" accept="image/*"><small class="inline-help">Stored locally in IndexedDB. Leave blank while editing to keep the existing receipt.</small></div>
    <button class="btn primary">${item.id?"Save expense":"Add expense"}</button>
  </form>`;
}

function bookingFormHTMLV2(item={}) {
  const t=trip();
  return `<form id="bookingFormV2" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row"><label>TYPE</label><select name="type">${bookingTypeOptions(item.type||"Flight")}</select></div>
    <div class="form-row"><label>TITLE</label><input name="title" required value="${esc(item.title||"")}" placeholder="Flight to Tokyo (NRT)"></div>
    <div class="form-row two"><div><label>START DATE</label><input name="date" type="date" value="${item.date||t.startDate}" required></div><div><label>START TIME</label><input name="time" type="time" value="${item.time||""}"></div></div>
    <div class="form-row two"><div><label>END DATE</label><input name="endDate" type="date" value="${item.endDate||""}"></div><div><label>END TIME</label><input name="endTime" type="time" value="${item.endTime||""}"></div></div>
    <div class="form-row"><label>CONFIRMATION / REFERENCE</label><input name="confirmation" value="${esc(item.confirmation||"")}"></div>
    <div class="form-row"><label>ADDRESS</label><input name="address" value="${esc(item.address||"")}"></div>
    <div class="form-row"><label>BOOKING LINK</label><input name="link" type="url" value="${esc(item.link||"")}"></div>
    <div class="form-row"><label>STATUS</label><select name="status">${["Saved","Confirmed","Pending","Cancelled"].map(x=>`<option ${item.status===x?"selected":""}>${x}</option>`).join("")}</select></div>
    <div class="form-row"><label>NOTES</label><textarea name="notes">${esc(item.notes||"")}</textarea></div>
    <div class="form-row"><label>TICKET / QR / ATTACHMENT</label><input name="attachment" type="file" accept="image/*,.pdf"><small class="inline-help">Stored on this device. Leave blank while editing to keep the existing attachment.</small></div>
    <button class="btn primary">${item.id?"Save booking":"Save booking"}</button>
  </form>`;
}

function packingFormHTMLV2(item={}) {
  return `<form id="packingFormV2" data-edit-id="${item.id||""}" class="form-grid"><div class="form-row"><label>ITEM</label><input name="name" required value="${esc(item.name||"")}" placeholder="Power bank"></div><div class="form-row two"><div><label>CATEGORY</label><select name="category">${["Essentials","Clothing","Toiletries","Electronics","Documents","Health","Other"].map(x=>`<option ${item.category===x?"selected":""}>${x}</option>`).join("")}</select></div><div><label>QUANTITY</label><input name="quantity" type="number" min="1" value="${item.quantity||1}"></div></div><button class="btn primary">${item.id?"Save item":"Add item"}</button></form>`;
}

function taskFormHTMLV2(item={}) {
  return `<form id="taskFormV2" data-edit-id="${item.id||""}" class="form-grid"><div class="form-row"><label>TASK</label><input name="name" required value="${esc(item.name||"")}"></div><div class="form-row two"><div><label>CATEGORY</label><select name="category">${["Documents","Safety","Connectivity","Money","Offline","Transport","Health","Home","Other"].map(x=>`<option ${item.category===x?"selected":""}>${x}</option>`).join("")}</select></div><div><label>PRIORITY</label><select name="priority">${["High","Medium","Low"].map(x=>`<option ${item.priority===x?"selected":""}>${x}</option>`).join("")}</select></div></div><div class="form-row"><label>DUE DATE</label><input name="dueDate" type="date" value="${item.dueDate||""}"></div><div class="form-row"><label>DETAIL</label><input name="detail" value="${esc(item.detail||"")}"></div><button class="btn primary">${item.id?"Save task":"Add task"}</button></form>`;
}

function memoryFormHTMLV2(item={}) {
  const t=trip();
  return `<form id="memoryFormV2" data-edit-id="${item.id||""}" class="form-grid"><div class="form-row two"><div><label>DATE</label><input name="date" type="date" value="${item.date||activeDate(t)}" required></div><div><label>TIME</label><input name="time" type="time" value="${item.time||""}"></div></div><div class="form-row"><label>TITLE</label><input name="title" value="${esc(item.title||"")}" placeholder="Enoshima sunset"></div><div class="form-row"><label>JOURNAL NOTE</label><textarea name="note" placeholder="A tiny memory from today...">${esc(item.note||"")}</textarea></div><div class="form-row"><label>LOCATION / PLACE</label><input name="location" value="${esc(item.location||"")}" placeholder="Enoshima, Kanagawa"></div><div class="form-row two"><div><label>LATITUDE</label><input name="lat" type="number" step="any" value="${item.lat??""}"></div><div><label>LONGITUDE</label><input name="lng" type="number" step="any" value="${item.lng??""}"></div></div><button class="btn soft" type="button" data-action="fill-current-location-v2" data-target-form="memoryFormV2">◎ Use current location</button><div class="form-row"><label>PHOTO</label><input name="photo" type="file" accept="image/*"><small class="inline-help">Stored locally. Leave blank while editing to keep the existing photo.</small></div><button class="btn primary">${item.id?"Save memory":"Save memory"}</button></form>`;
}

function tripFormHTMLV2() {
  return `<form id="tripFormV2" class="form-grid"><div class="form-row"><label>TRIP NAME</label><input name="title" required placeholder="Seoul 2027"></div><div class="form-row"><label>DESTINATION</label><input name="destination" required placeholder="South Korea"></div><div class="form-row two"><div><label>START</label><input name="startDate" type="date" required></div><div><label>END</label><input name="endDate" type="date" required></div></div><div class="form-row two"><div><label>COUNTRY EMOJI</label><input name="countryEmoji" value="✈️"></div><div><label>CURRENCY</label><select name="baseCurrency">${currencyOptions("JPY")}</select></div></div><button class="btn primary">Create trip</button></form>`;
}

function quick(type) {
  if(!type){openModal("Quick Add",`<div class="grid-2">${[["activity","🗓️","Activity"],["place","📍","Place"],["expense","💸","Expense"],["booking","🎟️","Booking"],["packing","🧳","Packing Item"],["task","✅","Pre-trip Task"],["memory","📸","Memory"],["trip","🍓","New Trip"]].map(([k,e,l])=>`<button class="feature-btn" data-action="quick-add-type" data-type="${k}"><span class="feature-icon">${e}</span><span><strong>${l}</strong></span><span class="arrow">›</span></button>`).join("")}</div>`);return;}
  if(type==="trip"){newTrip();return;}
  const forms={activity:activityFormHTMLV2(),place:placeFormHTMLV2(),expense:expenseFormHTMLV2(),booking:bookingFormHTMLV2(),packing:packingFormHTMLV2(),task:taskFormHTMLV2(),memory:memoryFormHTMLV2()};
  openModal(({activity:"Add Activity",place:"Save Place",expense:"Add Expense",booking:"Add Booking",packing:"Add Packing Item",task:"Add Pre-trip Task",memory:"Add Memory"})[type],forms[type]);
}

function newTrip(){openModal("Create Trip",tripFormHTMLV2())}

function editBudget() {
  const t=trip(), cats=window.ICHIGO_DATA?.expenseCategories||[];
  openModal("Edit Budget",`<form id="budgetFormV2" class="form-grid"><div class="form-row"><label>TOTAL TRIP BUDGET (${t.baseCurrency})</label><input name="totalBudget" type="number" value="${t.totalBudget}" min="0"></div><div class="form-row"><label>DAILY BUDGET (${t.baseCurrency})</label><input name="dailyBudget" type="number" value="${t.dailyBudget}" min="0"></div><div class="modal-section"><h3>Category budgets</h3>${cats.map(c=>`<div class="form-row" style="margin-bottom:7px"><label>${c.icon} ${esc(c.name)}</label><input name="cat_${c.name}" type="number" min="0" value="${Number(t.categoryBudgets[c.name]||0)}"></div>`).join("")}</div><button class="btn primary">Save budget</button></form>`);
}

async function storeFileInputV2(input, kind, compress=false) {
  const file=input?.files?.[0];
  if(!file||!window.IchigoDB)return {key:"",name:""};
  let blob=file;
  if(compress&&file.type?.startsWith("image/")) blob=await IchigoDB.compressImage(file);
  const key=await IchigoDB.put(blob,{name:file.name,kind,mime:blob.type||file.type});
  return {key,name:file.name};
}

async function removeAttachedFileV2(item,collection) {
  if(!item||!window.IchigoDB)return;
  const key=collection==="expenses"?item.receiptKey:collection==="bookings"?item.attachmentKey:collection==="memories"?item.photoKey:"";
  if(key)try{await IchigoDB.remove(key)}catch{}
}

function editEssentialsModalV2() {
  const e=trip().essentials;
  openModal("Offline Essentials",`<form id="essentialsFormV2" class="form-grid"><div class="modal-section"><h3>🏨 Stay</h3><div class="form-row"><label>HOTEL / STAY NAME</label><input name="hotelName" value="${esc(e.hotelName||"")}"></div><div class="form-row"><label>ADDRESS</label><textarea name="hotelAddress">${esc(e.hotelAddress||"")}</textarea></div><div class="form-row"><label>PHONE</label><input name="hotelPhone" value="${esc(e.hotelPhone||"")}"></div></div><div class="modal-section"><h3>🛡️ Insurance</h3><div class="form-row"><label>PROVIDER</label><input name="insuranceProvider" value="${esc(e.insuranceProvider||"")}"></div><div class="form-row two"><div><label>POLICY REFERENCE</label><input name="insurancePolicy" value="${esc(e.insurancePolicy||"")}"></div><div><label>EMERGENCY PHONE</label><input name="insurancePhone" value="${esc(e.insurancePhone||"")}"></div></div></div><div class="modal-section"><h3>🩺 Medical / safety notes</h3><textarea name="medicalNotes">${esc(e.medicalNotes||"")}</textarea></div><div class="modal-section"><h3>🚃 Transport notes</h3><textarea name="transitNotes">${esc(e.transitNotes||"")}</textarea></div><button class="btn primary">Save essentials</button></form>`);
}

function packingTemplatesModalV2() {
  const templates=window.ICHIGO_DATA?.packingTemplates||{};
  openModal("Packing Templates",`<div class="template-grid">${Object.entries(templates).map(([name,items])=>`<button class="template-card" data-action="apply-packing-template-v2" data-template="${esc(name)}"><strong>🧳 ${esc(name)}</strong><small>${items.length} starter items</small></button>`).join("")}</div>`);
}

function copyPackingModalV2() {
  const others=state.trips.filter(x=>x.id!==trip().id&&x.packing?.length);
  openModal("Copy Packing List",others.length?`<div class="feature-menu">${others.map(x=>`<button class="feature-btn" data-action="apply-copy-packing-v2" data-trip-id="${x.id}"><span class="feature-icon">${esc(x.countryEmoji||"✈️")}</span><span><strong>${esc(x.title)}</strong><small>${x.packing.length} items</small></span><span class="arrow">›</span></button>`).join("")}</div>`:empty("🧳","No other packing list yet","Once another trip has a packing list, you can copy it here."));
}

function moveActivityModalV2(id) {
  const item=trip().itinerary.find(x=>x.id===id);if(!item)return;
  openModal("Move Activity",`<form id="moveActivityFormV2" data-id="${id}" class="form-grid"><div class="form-row"><label>MOVE TO</label><select name="date">${allDates().map(d=>`<option value="${d}" ${d===item.date?"selected":""}>Day ${dayNo(d)} · ${nice(d,{weekday:"short",month:"short",day:"numeric"})}</option>`).join("")}</select></div><button class="btn primary">Move activity</button></form>`);
}

function addContactModalV2(){openModal("Add Emergency Contact",`<form id="contactFormV2" class="form-grid"><div class="form-row"><label>NAME</label><input name="name" required></div><div class="form-row"><label>PHONE</label><input name="phone" required></div><div class="form-row"><label>NOTE</label><input name="note" placeholder="Insurance, family, embassy..."></div><button class="btn primary">Add contact</button></form>`)}
function addDocumentModalV2(){openModal("Add Document Reference",`<form id="documentFormV2" class="form-grid"><div class="form-row"><label>DOCUMENT</label><input name="name" required placeholder="Travel insurance"></div><div class="form-row"><label>REFERENCE / NOTE</label><textarea name="reference" placeholder="Reference number, where the file is saved, etc."></textarea></div><button class="btn primary">Add document</button></form>`)}
function addPhraseModalV2(){openModal("Add Useful Phrase",`<form id="phraseFormV2" class="form-grid"><div class="form-row"><label>LOCAL LANGUAGE</label><input name="jp" required></div><div class="form-row"><label>PRONUNCIATION / ROMAJI</label><input name="romaji"></div><div class="form-row"><label>MEANING</label><input name="en"></div><button class="btn primary">Add phrase</button></form>`)}

async function openLocalFileV2(key) {
  if(!key||!window.IchigoDB)return;
  const win=window.open("","_blank");
  try {
    const record=await IchigoDB.get(key);if(!record)throw Error("File not found");
    const url=URL.createObjectURL(record.blob);
    if(win) win.location.href=url; else window.location.href=url;
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  } catch(err) { if(win)win.close();notify("Could not open that local file."); }
}

async function refreshLiveRateV2() {
  if(!navigator.onLine){notify("You're offline. Ichigo will use the last saved rate.");return;}
  const a=document.querySelector("#convFrom")?.value||trip().converter.from,b=document.querySelector("#convTo")?.value||trip().converter.to;
  if(a===b){notify("Those currencies are already the same.");return;}
  notify("Updating exchange rate…");
  try {
    const response=await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(a)}/${encodeURIComponent(b)}`,{cache:"no-store"});
    if(!response.ok)throw Error("Rate service unavailable");
    const data=await response.json();
    if(!data?.rate)throw Error("No rate returned");
    setLivePairV2(a,b,data.rate,data.date||"");
    trip().converter.from=a;trip().converter.to=b;trip().converter.lastLiveUpdate=data.date||new Date().toISOString();save();render();notify("Live rate saved for offline use ✓");
  } catch(err) { console.warn(err);notify("Couldn't update the live rate. Your saved offline rate is still available."); }
}

function fillCurrentLocationV2(formId) {
  if(!navigator.geolocation){notify("Location isn't available in this browser.");return;}
  notify("Getting your location…");
  navigator.geolocation.getCurrentPosition(pos=>{const form=document.getElementById(formId);if(!form)return;const lat=form.querySelector('[name="lat"]'),lng=form.querySelector('[name="lng"]');if(lat)lat.value=pos.coords.latitude.toFixed(6);if(lng)lng.value=pos.coords.longitude.toFixed(6);notify("Coordinates added ✓")},()=>notify("Ichigo couldn't access your location."),{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
}

async function copyTextV2(text) {
  try { await navigator.clipboard.writeText(text);notify("Copied ✓"); }
  catch { const ta=document.createElement("textarea");ta.value=text;document.body.append(ta);ta.select();document.execCommand("copy");ta.remove();notify("Copied ✓"); }
}

async function deleteItemV2(collection,id) {
  const t=trip(), item=t[collection]?.find(x=>x.id===id);if(!item)return;
  if(!confirm("Delete this item?"))return;
  await removeAttachedFileV2(item,collection);
  t[collection]=t[collection].filter(x=>x.id!==id);
  if(collection==="itinerary")renumberDay(item.date,t);
  save();render();notify("Deleted");
}

/* Extra click actions for Build 2. Build 1's listener continues to handle
   navigation and shared actions such as set-plan-view and quick-add-type. */
document.addEventListener("click",async e=>{
  const el=e.target.closest("[data-action]");if(!el)return;const a=el.dataset.action;

  if(a==="shelf-filter-v2"){state.shelfFilter=el.dataset.filter;save();render()}
  if(a==="today-essentials-v2"){state.currentView="plan";state.planView="essentials";save();render()}
  if(a==="favorite-place-v2"){const p=trip().places.find(x=>x.id===el.dataset.id);if(p)p.favorite=!p.favorite;save();render()}
  if(a==="edit-place-v2"){const p=trip().places.find(x=>x.id===el.dataset.id);if(p)openModal("Edit Place",placeFormHTMLV2(p))}
  if(a==="edit-activity-v2"){const i=trip().itinerary.find(x=>x.id===el.dataset.id);if(i)openModal("Edit Activity",activityFormHTMLV2(i))}
  if(a==="duplicate-activity-v2"){const i=trip().itinerary.find(x=>x.id===el.dataset.id);if(i){const copy={...clone(i),id:uuid(),title:`${i.title} (copy)`,order:activitiesOn(i.date).length};trip().itinerary.push(copy);save();render();notify("Activity duplicated")}}
  if(a==="move-activity-v2")moveActivityModalV2(el.dataset.id)
  if(a==="delete-v2")await deleteItemV2(el.dataset.collection,el.dataset.id)
  if(a==="open-file-v2")await openLocalFileV2(el.dataset.fileKey)
  if(a==="locate-me-v2"){if(!navigator.geolocation){notify("Location isn't available.");return}navigator.geolocation.getCurrentPosition(p=>{ichigoMapInstance?.setView([p.coords.latitude,p.coords.longitude],15);L?.circleMarker([p.coords.latitude,p.coords.longitude],{radius:8,color:"#ff4f78"}).addTo(ichigoMapInstance).bindPopup("You are here 🍓").openPopup()},()=>notify("Location permission wasn't available."))}
  if(a==="fill-current-location-v2")fillCurrentLocationV2(el.dataset.targetForm)

  if(a==="edit-booking-v2"){const b=trip().bookings.find(x=>x.id===el.dataset.id);if(b)openModal("Edit Booking",bookingFormHTMLV2(b))}
  if(a==="packing-templates-v2")packingTemplatesModalV2()
  if(a==="copy-packing-v2")copyPackingModalV2()
  if(a==="apply-packing-template-v2"){const items=window.ICHIGO_DATA?.packingTemplates?.[el.dataset.template]||[];const existing=new Set(trip().packing.map(x=>x.name.toLowerCase()));items.forEach(([category,name,quantity])=>{if(!existing.has(name.toLowerCase()))trip().packing.push({id:uuid(),category,name,quantity,done:false})});save();closeModal();render();notify("Packing template added")}
  if(a==="apply-copy-packing-v2"){const src=state.trips.find(x=>x.id===el.dataset.tripId);if(src){trip().packing=src.packing.map(x=>({...clone(x),id:uuid(),done:false}));save();closeModal();render();notify("Packing list copied")}}
  if(a==="pack-all-v2"){const done=el.dataset.mode==="pack";trip().packing.forEach(x=>x.done=done);save();render()}
  if(a==="edit-pack-v2"){const i=trip().packing.find(x=>x.id===el.dataset.id);if(i)openModal("Edit Packing Item",packingFormHTMLV2(i))}

  if(a==="pretrip-template-v2"){const existing=new Set(trip().preTrip.map(x=>x.name.toLowerCase()));(window.ICHIGO_DATA?.preTripTemplate||[]).forEach((x,index)=>{if(!existing.has(x.name.toLowerCase()))trip().preTrip.push({id:uuid(),...clone(x),done:false,dueDate:dateOffset(trip().startDate,-Math.max(2,30-index*3))})});save();render();notify("Starter checklist added")}
  if(a==="enable-reminders-v2"){if(!window.Notification){notify("Notifications aren't supported here. Due tasks will still appear in Ichigo.");return}const result=await Notification.requestPermission();notify(result==="granted"?"Due-task notifications enabled ✓":"Ichigo will keep reminders inside the app.")}
  if(a==="edit-task-v2"){const i=trip().preTrip.find(x=>x.id===el.dataset.id);if(i)openModal("Edit Task",taskFormHTMLV2(i))}

  if(a==="edit-essentials-v2")editEssentialsModalV2()
  if(a==="add-contact-v2")addContactModalV2()
  if(a==="add-document-v2")addDocumentModalV2()
  if(a==="add-phrase-v2")addPhraseModalV2()
  if(a==="delete-essential-v2"){const list=trip().essentials[el.dataset.kind]||[];trip().essentials[el.dataset.kind]=list.filter(x=>x.id!==el.dataset.id);save();render()}
  if(a==="copy-text-v2")copyTextV2(el.dataset.text||"")

  if(a==="edit-expense-v2"){const i=trip().expenses.find(x=>x.id===el.dataset.id);if(i)openModal("Edit Expense",expenseFormHTMLV2(i))}
  if(a==="refresh-live-rate-v2")await refreshLiveRateV2()
  if(a==="swap-currency-v2"){const t=trip(),a=t.converter.from,b=t.converter.to;t.converter.from=b;t.converter.to=a;save();render()}
  if(a==="clear-converter-history-v2"){trip().converter.history=[];save();render();notify("Conversion history cleared")}

  if(a==="edit-memory-v2"){const m=trip().memories.find(x=>x.id===el.dataset.id);if(m)openModal("Edit Memory",memoryFormHTMLV2(m))}
  if(a==="save-cover-v2"){const input=document.querySelector("#tripCoverInputV2");if(!input?.files?.[0]){notify("Choose a cover photo first.");return}try{const blob=await IchigoDB.compressImage(input.files[0],1600,.8);if(trip().coverKey)await IchigoDB.remove(trip().coverKey);trip().coverKey=await IchigoDB.put(blob,{name:input.files[0].name,kind:"cover"});save();render();notify("Trip cover saved ✓")}catch{notify("Couldn't save the cover photo.")}}

  if(a==="reset-demo"){try{await IchigoDB?.clear()}catch{}}
});

/* Build 2 form submissions. */
document.addEventListener("submit",async e=>{
  const f=e.target;
  if(!f.id?.endsWith("V2"))return;
  e.preventDefault();
  const d=Object.fromEntries(new FormData(f).entries()),t=trip(),editId=f.dataset.editId||"";

  if(f.id==="activityFormV2"){
    const old=editId?t.itinerary.find(x=>x.id===editId):null, oldDate=old?.date;
    const item=old||{id:uuid(),order:activitiesOn(d.date,t).length};
    Object.assign(item,{date:d.date,time:d.time||"",duration:Number(d.duration||0),travelTime:Number(d.travelTime||0),type:d.type,title:d.title.trim(),place:d.place.trim(),address:d.address.trim(),notes:d.notes.trim(),flexible:f.elements.flexible.checked,lat:d.lat?Number(d.lat):null,lng:d.lng?Number(d.lng):null});
    if(!old)t.itinerary.push(item);
    if(oldDate&&oldDate!==d.date){renumberDay(oldDate,t);item.order=activitiesOn(d.date,t).length;}
    renumberDay(d.date,t);save();closeModal();state.currentView="plan";state.planView="itinerary";save();render();notify(editId?"Activity updated":"Activity added");
  }

  if(f.id==="placeFormV2"){
    const old=editId?t.places.find(x=>x.id===editId):null,item=old||{id:uuid(),votes:{},visited:false};
    Object.assign(item,{name:d.name.trim(),area:d.area.trim(),category:d.category,priority:d.priority,favorite:f.elements.favorite.checked,openingHours:d.openingHours.trim(),address:d.address.trim(),lat:d.lat?Number(d.lat):null,lng:d.lng?Number(d.lng):null,mapUrl:d.mapUrl.trim(),reservationUrl:d.reservationUrl.trim(),tags:d.tags.split(",").map(x=>x.trim()).filter(Boolean),notes:d.notes.trim()});
    if(!old)t.places.push(item);save();closeModal();state.currentView="plan";state.planView="places";save();render();notify(editId?"Place updated":"Place saved");
  }

  if(f.id==="expenseFormV2"){
    const old=editId?t.expenses.find(x=>x.id===editId):null,item=old||{id:uuid(),createdAt:Date.now(),receiptKey:"",receiptName:""};
    const receipt=f.querySelector('[name="receipt"]');
    if(receipt?.files?.[0]){try{const stored=await storeFileInputV2(receipt,"receipt",true);if(item.receiptKey)await IchigoDB.remove(item.receiptKey);item.receiptKey=stored.key;item.receiptName=stored.name}catch{notify("Receipt couldn't be saved, but the expense will be kept.")}}
    Object.assign(item,{date:d.date,title:d.merchant.trim(),merchant:d.merchant.trim(),category:d.category,amount:Number(d.amount),payment:d.payment,paidBy:d.paidBy,participants:d.split==="equal"?t.travelers.map(x=>x.id):[d.paidBy],split:d.split,notes:d.notes.trim()});
    if(!old)t.expenses.push(item);save();closeModal();state.currentView="spend";state.spendView="expenses";save();render();notify(editId?"Expense updated":"Expense added");
  }

  if(f.id==="bookingFormV2"){
    const old=editId?t.bookings.find(x=>x.id===editId):null,item=old||{id:uuid(),attachmentKey:"",attachmentName:""};
    const attachment=f.querySelector('[name="attachment"]');
    if(attachment?.files?.[0]){try{let file=attachment.files[0],blob=file;if(file.type.startsWith("image/"))blob=await IchigoDB.compressImage(file,1600,.82);if(item.attachmentKey)await IchigoDB.remove(item.attachmentKey);item.attachmentKey=await IchigoDB.put(blob,{name:file.name,kind:"booking",mime:blob.type||file.type});item.attachmentName=file.name}catch{notify("Attachment couldn't be stored, but the booking will be kept.")}}
    Object.assign(item,{type:d.type,title:d.title.trim(),date:d.date,time:d.time||"",endDate:d.endDate||"",endTime:d.endTime||"",confirmation:d.confirmation.trim(),address:d.address.trim(),link:d.link.trim(),status:d.status,notes:d.notes.trim()});
    if(!old)t.bookings.push(item);save();closeModal();state.currentView="plan";state.planView="bookings";save();render();notify(editId?"Booking updated":"Booking saved");
  }

  if(f.id==="packingFormV2"){
    const old=editId?t.packing.find(x=>x.id===editId):null,item=old||{id:uuid(),done:false};Object.assign(item,{name:d.name.trim(),category:d.category,quantity:Number(d.quantity||1)});if(!old)t.packing.push(item);save();closeModal();state.currentView="plan";state.planView="packing";save();render();notify(editId?"Packing item updated":"Packing item added");
  }

  if(f.id==="taskFormV2"){
    const old=editId?t.preTrip.find(x=>x.id===editId):null,item=old||{id:uuid(),done:false};Object.assign(item,{name:d.name.trim(),category:d.category,priority:d.priority,dueDate:d.dueDate||"",detail:d.detail.trim()});if(!old)t.preTrip.push(item);save();closeModal();state.currentView="plan";state.planView="before";save();render();notify(editId?"Task updated":"Task added");
  }

  if(f.id==="memoryFormV2"){
    const old=editId?t.memories.find(x=>x.id===editId):null,item=old||{id:uuid(),photoKey:""};const photo=f.querySelector('[name="photo"]');
    if(photo?.files?.[0]){try{const blob=await IchigoDB.compressImage(photo.files[0],1600,.8);if(item.photoKey)await IchigoDB.remove(item.photoKey);item.photoKey=await IchigoDB.put(blob,{name:photo.files[0].name,kind:"memory"})}catch{notify("Photo couldn't be saved, but the journal note will be kept.")}}
    Object.assign(item,{date:d.date,time:d.time||"",title:d.title.trim(),note:d.note.trim(),location:d.location.trim(),lat:d.lat?Number(d.lat):null,lng:d.lng?Number(d.lng):null});if(!old)t.memories.push(item);save();closeModal();state.currentView="trip";state.tripView="memories";save();render();notify(editId?"Memory updated":"Memory saved");
  }

  if(f.id==="tripFormV2"){
    const n=ensureTripV2({id:uuid(),title:d.title.trim(),destination:d.destination.trim(),cityLabel:d.destination.toUpperCase(),countryEmoji:d.countryEmoji||"✈️",startDate:d.startDate,endDate:d.endDate,baseCurrency:d.baseCurrency,homeCurrency:"PHP",totalBudget:0,dailyBudget:0,categoryBudgets:{},coverKey:"",travelers:[],itinerary:[],places:[],bookings:[],packing:[],preTrip:[],expenses:[],memories:[]});state.trips.push(n);state.currentTripId=n.id;state.currentView="home";save();closeModal();render();notify("New trip created 🍓");
  }

  if(f.id==="budgetFormV2"){
    t.totalBudget=Number(d.totalBudget||0);t.dailyBudget=Number(d.dailyBudget||0);(window.ICHIGO_DATA?.expenseCategories||[]).forEach(c=>t.categoryBudgets[c.name]=Number(d[`cat_${c.name}`]||0));save();closeModal();render();notify("Budget updated");
  }

  if(f.id==="moveActivityFormV2"){
    const item=t.itinerary.find(x=>x.id===f.dataset.id);if(item){const old=item.date;item.date=d.date;item.order=activitiesOn(d.date,t).length;renumberDay(old,t);renumberDay(d.date,t);save()}closeModal();render();notify("Activity moved");
  }

  if(f.id==="essentialsFormV2"){
    Object.assign(t.essentials,{hotelName:d.hotelName.trim(),hotelAddress:d.hotelAddress.trim(),hotelPhone:d.hotelPhone.trim(),insuranceProvider:d.insuranceProvider.trim(),insurancePolicy:d.insurancePolicy.trim(),insurancePhone:d.insurancePhone.trim(),medicalNotes:d.medicalNotes.trim(),transitNotes:d.transitNotes.trim()});save();closeModal();render();notify("Offline essentials saved");
  }

  if(f.id==="contactFormV2"){t.essentials.contacts.push({id:uuid(),name:d.name.trim(),phone:d.phone.trim(),note:d.note.trim()});save();closeModal();render();notify("Contact added")}
  if(f.id==="documentFormV2"){t.essentials.documents.push({id:uuid(),name:d.name.trim(),reference:d.reference.trim()});save();closeModal();render();notify("Document reference added")}
  if(f.id==="phraseFormV2"){t.essentials.phrases.push({id:uuid(),jp:d.jp.trim(),romaji:d.romaji.trim(),en:d.en.trim()});save();closeModal();render();notify("Phrase added")}
});

/* Touch / pointer reorder on the small handle only, preserving page scroll. */
document.addEventListener("pointerdown",e=>{
  const h=e.target.closest('.drag-handle[data-action="drag-activity-v2"]');if(!h)return;dragActivityId=h.dataset.id;dragPointerId=e.pointerId;h.setPointerCapture?.(e.pointerId);h.closest(".itinerary-card")?.classList.add("dragging");e.preventDefault();
});
document.addEventListener("pointerup",e=>{
  if(!dragActivityId||dragPointerId!==e.pointerId)return;const source=trip().itinerary.find(x=>x.id===dragActivityId),targetEl=document.elementFromPoint(e.clientX,e.clientY)?.closest(".itinerary-card"),target=targetEl?trip().itinerary.find(x=>x.id===targetEl.dataset.activityId):null;document.querySelector('.itinerary-card.dragging')?.classList.remove("dragging");
  if(source&&target&&source.id!==target.id&&source.date===target.date){const day=activitiesOn(source.date),from=day.findIndex(x=>x.id===source.id),to=day.findIndex(x=>x.id===target.id);day.splice(to,0,day.splice(from,1)[0]);day.forEach((x,i)=>x.order=i);save();render();notify("Itinerary reordered")}
  dragActivityId="";dragPointerId=null;
});




/* =====================================================================
   ICHIGO BUILD 3 — APP POLISH + RESILIENCE
   1. Full CRUD polish
   2. Itinerary power tools
   3. Trip Inbox
   4. Today Mode 3.0
   5. Map filters + route line
   6. Foreground local reminders
   7. In-app update system
   8. Schema migrations
   9. Full backup including IndexedDB files
  10. App settings
  11. Trip customization
  12. Universal search
  13. First-run onboarding
  14. Accessibility / mobile polish
  15. Testing + debug panel
   ===================================================================== */

const APP_VERSION_V3 = "3.0.0";
const APP_SCHEMA_VERSION_V3 = 3;
const CACHE_VERSION_V3 = "ichigo-build3-v1";
const REMINDER_LOG_V3 = "ichigo-reminder-log-v3";

const DEFAULT_SETTINGS_V3 = {
  travelerName: "",
  homeCountry: "",
  homeCurrency: "USD",
  defaultTripCurrency: "USD",
  dateFormat: "friendly",
  timeFormat: "12h",
  mapApp: "google",
  theme: "strawberry",
  notifications: {
    enabled: false,
    activityLead: 15,
    bookingLead: 60,
    taskDue: true
  }
};

let reminderTimerV3 = null;
let onboardingShownV3 = false;
let pendingSWRegistrationV3 = null;
let lastFocusedBeforeModalV3 = null;
let reloadForUpdateV3 = false;

function deepMergeV3(base, extra) {
  const out = clone(base);
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value) && out[key] && typeof out[key] === "object" && !Array.isArray(out[key])) out[key] = deepMergeV3(out[key], value);
    else out[key] = value;
  });
  return out;
}

function save() {
  state.schemaVersion = APP_SCHEMA_VERSION_V3;
  state.appVersion = APP_VERSION_V3;
  state.updatedAt = Date.now();
  localStorage.setItem(STORE, JSON.stringify(state));
}

function ensureStateV3() {
  state.settings = deepMergeV3(DEFAULT_SETTINGS_V3, state.settings || {});
  state.schemaVersion = Number(state.schemaVersion || 1);
  state.appVersion ||= APP_VERSION_V3;
  state.onboarding ||= { completed: false, step: 0 };
  state.migrations ||= [];
  state.mapFilters ||= { day: "active", category: "All", source: "all" };
  state.collapsedDays ||= {};
  state.activeItineraryDate ||= "";
  state.launchActionV3 ||= "";
  return state;
}

function ensureTripV3(t) {
  t = ensureTripV2(t);
  if (!t) return t;
  t.inbox ||= [];
  t.theme ||= "inherit";
  t.accentColor ||= "";
  t.dayNotes ||= {};
  t.itinerary.forEach(item => {
    item.completed ??= false;
    item.completedAt ||= "";
    item.arrivedAt ||= "";
    item.reminderLead = Number(item.reminderLead ?? state.settings?.notifications?.activityLead ?? 15);
  });
  t.bookings.forEach(item => item.reminderLead = Number(item.reminderLead ?? state.settings?.notifications?.bookingLead ?? 60));
  t.inbox.forEach(item => {
    item.id ||= uuid();
    item.type ||= "Note";
    item.title ||= "Untitled idea";
    item.note ||= "";
    item.url ||= "";
    item.fileKey ||= "";
    item.status ||= "inbox";
    item.createdAt ||= Date.now();
  });
  return t;
}

function migrateAllTripsV3(persist = false) {
  ensureStateV3();
  const before = Number(state.schemaVersion || 1);
  state.trips = (state.trips || []).map(ensureTripV3);
  if (before < 3 && !state.migrations.some(x => x.version === 3)) {
    state.migrations.push({ version: 3, at: Date.now(), note: "Build 3 settings, inbox, reminders and customization" });
  }
  state.schemaVersion = APP_SCHEMA_VERSION_V3;
  state.appVersion = APP_VERSION_V3;
  if (persist) save();
}

function trip() {
  ensureStateV3();
  return ensureTripV3(state.trips.find(x => x.id === state.currentTripId) || state.trips[0]);
}

function nice(s, options = null) {
  const d = parseDate(s);
  if (!d) return "";
  if (options) return d.toLocaleDateString(undefined, options);
  const format = state?.settings?.dateFormat || "friendly";
  if (format === "dmy") return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  if (format === "mdy") return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/${d.getFullYear()}`;
  if (format === "iso") return s;
  return d.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
}

function formatTimeV3(time) {
  if (!time) return "Anytime";
  if ((state.settings?.timeFormat || "12h") === "24h") return time;
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,"0")} ${suffix}`;
}

function shadeHexV3(hex, amount = -20) {
  const clean = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return "#ff4f78";
  const n = parseInt(clean,16);
  const clamp = x => Math.max(0, Math.min(255, x));
  const r=clamp((n>>16)+amount), g=clamp(((n>>8)&255)+amount), b=clamp((n&255)+amount);
  return `#${[r,g,b].map(x=>x.toString(16).padStart(2,"0")).join("")}`;
}

function applyAppearanceV3() {
  ensureStateV3();
  const t = trip();
  const theme = t.theme && t.theme !== "inherit" ? t.theme : state.settings.theme;
  document.documentElement.dataset.theme = theme || "strawberry";
  if (t.accentColor) {
    document.documentElement.style.setProperty("--pink", t.accentColor);
    document.documentElement.style.setProperty("--pink2", shadeHexV3(t.accentColor, -22));
  } else {
    document.documentElement.style.removeProperty("--pink");
    document.documentElement.style.removeProperty("--pink2");
  }
}

function render() {
  ensureStateV3();
  state.trips = (state.trips || []).map(ensureTripV3);
  applyAppearanceV3();
  document.querySelectorAll(".nav-item").forEach(x => {
    const active = x.dataset.nav === state.currentView;
    x.classList.toggle("active", active);
    if (active) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current");
  });
  ({home:renderHome,plan:renderPlan,today:renderToday,spend:renderSpend,together:renderTogether,trip:renderTrip}[state.currentView]||renderHome)();
  updateOnline();
  afterRenderV2();
  afterRenderV3();
}

function afterRenderV3() {
  hydrateFilesV2();
  updateStorageDiagnosticsV3();
  maybeShowOnboardingV3();
  if (state.launchActionV3 === "search") { state.launchActionV3=""; save(); setTimeout(()=>openSearchV3(),60); }
  startReminderEngineV3();
}

/* ---------- Modal accessibility ---------- */
function openModal(title, html) {
  lastFocusedBeforeModalV3 = document.activeElement;
  const tpl = document.querySelector("#modalTemplate");
  const node = tpl.content.cloneNode(true);
  modalRoot.replaceChildren(node);
  modalRoot.querySelector("#modalTitle").textContent = title;
  modalRoot.querySelector("#modalBody").innerHTML = html;
  const card = modalRoot.querySelector(".modal-card");
  card?.setAttribute("tabindex", "-1");
  requestAnimationFrame(() => (card?.querySelector("input,select,textarea,button,[href]") || card)?.focus());
}

function closeModal() {
  modalRoot.innerHTML = "";
  if (lastFocusedBeforeModalV3?.focus) lastFocusedBeforeModalV3.focus();
}

document.addEventListener("keydown", event => {
  if (!modalRoot.firstElementChild) return;
  if (event.key === "Escape") { event.preventDefault(); closeModal(); return; }
  if (event.key !== "Tab") return;
  const focusable=[...modalRoot.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first=focusable[0], last=focusable.at(-1);
  if (event.shiftKey && document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus()}
});

if (window.visualViewport) {
  const keyboardCheck=()=>document.body.classList.toggle("keyboard-open", window.visualViewport.height < window.innerHeight * .78);
  window.visualViewport.addEventListener("resize", keyboardCheck);
}

/* ---------- Universal search ---------- */
function searchIndexV3(query) {
  const q=String(query||"").trim().toLowerCase();
  if (!q) return [];
  const t=trip(), rows=[];
  const add=(kind,id,title,detail,haystack)=>{if(String(haystack).toLowerCase().includes(q))rows.push({kind,id,title,detail})};
  t.itinerary.forEach(x=>add("activity",x.id,x.title,`${nice(x.date)} · ${x.place||""}`,`${x.title} ${x.place} ${x.address} ${x.notes} ${x.date}`));
  t.places.forEach(x=>add("place",x.id,x.name,`${x.area||""} · ${x.category}`,`${x.name} ${x.area} ${x.category} ${x.address} ${(x.tags||[]).join(" ")} ${x.notes}`));
  t.bookings.forEach(x=>add("booking",x.id,x.title,`${x.type} · ${nice(x.date)}`,`${x.title} ${x.type} ${x.confirmation} ${x.address} ${x.notes}`));
  t.expenses.forEach(x=>add("expense",x.id,x.merchant||x.title,`${money(x.amount)} · ${x.category}`,`${x.merchant} ${x.title} ${x.category} ${x.notes} ${x.payment}`));
  t.packing.forEach(x=>add("packing",x.id,x.name,x.category,`${x.name} ${x.category}`));
  t.preTrip.forEach(x=>add("task",x.id,x.name,`${x.priority} · ${x.dueDate?nice(x.dueDate):"No due date"}`,`${x.name} ${x.category} ${x.priority} ${x.detail}`));
  t.memories.forEach(x=>add("memory",x.id,x.title||"Memory",`${nice(x.date)} · ${x.location||""}`,`${x.title} ${x.note} ${x.location} ${x.date}`));
  t.inbox.forEach(x=>add("inbox",x.id,x.title,x.type,`${x.title} ${x.type} ${x.note} ${x.url}`));
  return rows.slice(0,60);
}

function searchResultsHTMLV3(query) {
  const rows=searchIndexV3(query);
  if (!String(query||"").trim()) return `<div class="search-empty-v3">Search itinerary, places, bookings, expenses, packing, tasks, memories and your Trip Inbox.</div>`;
  if (!rows.length) return empty("🔎","Nothing found",`No Ichigo items matched “${esc(query)}”.`);
  const icons={activity:"🗓️",place:"📍",booking:"🎟️",expense:"🧾",packing:"🧳",task:"✅",memory:"📸",inbox:"📥"};
  return `<div class="search-results-v3">${rows.map(r=>`<button class="search-result-v3" data-action="search-result-v3" data-kind="${r.kind}" data-id="${r.id}"><span>${icons[r.kind]||"🍓"}</span><span><strong>${esc(r.title)}</strong><small>${esc(r.detail||"")}</small></span><span>›</span></button>`).join("")}</div>`;
}

function openSearchV3(query="") {
  openModal("Search Ichigo",`<div class="searchbox global-search-v3"><input id="globalSearchV3" value="${esc(query)}" placeholder="Search everything..." autocomplete="off" aria-label="Search all trip data"></div><div id="globalSearchResultsV3" style="margin-top:10px">${searchResultsHTMLV3(query)}</div>`);
}

function goToSearchResultV3(kind) {
  const map={activity:["plan","itinerary"],place:["plan","places"],booking:["plan","bookings"],packing:["plan","packing"],task:["plan","before"],inbox:["plan","inbox"],expense:["spend","expenses"],memory:["trip","memories"]};
  const [view,sub]=map[kind]||["home",""];
  state.currentView=view;
  if(view==="plan")state.planView=sub;
  if(view==="spend")state.spendView=sub;
  if(view==="trip")state.tripView=sub;
  save();closeModal();render();
}

/* ---------- Trip Inbox ---------- */
function inboxFormHTMLV3(item={}) {
  return `<form id="inboxFormV3" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row"><label>TYPE</label><select name="type">${(window.ICHIGO_DATA?.inboxTypes||[]).map(x=>`<option ${item.type===x?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
    <div class="form-row"><label>TITLE</label><input name="title" required value="${esc(item.title||"")}" placeholder="Random café I saw on TikTok"></div>
    <div class="form-row"><label>LINK</label><input name="url" type="url" value="${esc(item.url||"")}" placeholder="https://..."></div>
    <div class="form-row"><label>NOTE</label><textarea name="note" placeholder="Dump it here now; organize it later.">${esc(item.note||"")}</textarea></div>
    <div class="form-row"><label>SCREENSHOT / PHOTO</label><input name="attachment" type="file" accept="image/*"></div>
    <button class="btn primary" type="submit">${item.id?"Save changes":"Add to Trip Inbox"}</button>
  </form>`;
}

function inboxHTMLV3() {
  const arr=[...trip().inbox].sort((a,b)=>Number(a.status==="archived")-Number(b.status==="archived")||b.createdAt-a.createdAt);
  return `<div class="section-title"><h3>📥 Trip Inbox</h3><button data-action="add-inbox-v3">＋ Capture</button></div>
    <div class="notice-card"><span class="notice-icon">💡</span><span><strong>Dump first, organize later.</strong><p>Save random links, screenshots, restaurants and ideas without deciding where they belong yet.</p></span></div>
    <div class="list" style="margin-top:10px">${arr.length?arr.map(x=>`<article class="inbox-card-v3 ${x.status==="archived"?"archived":""}">
      ${x.fileKey?`<button class="inbox-thumb-v3" data-action="open-file-v2" data-file-key="${x.fileKey}" data-file-kind="image"><span>🖼️</span></button>`:`<div class="inbox-thumb-v3">📥</div>`}
      <div class="row-main"><div class="badge gray">${esc(x.type)}</div><h4>${esc(x.title)}</h4><p>${esc(x.note||"")}</p>${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener" class="inline-link-v3">Open saved link ↗</a>`:""}
        <div class="activity-actions"><button class="tiny-btn" data-action="edit-inbox-v3" data-id="${x.id}">Edit</button><button class="tiny-btn" data-action="convert-inbox-place-v3" data-id="${x.id}">→ Place</button><button class="tiny-btn" data-action="convert-inbox-activity-v3" data-id="${x.id}">→ Activity</button><button class="tiny-btn" data-action="archive-inbox-v3" data-id="${x.id}">${x.status==="archived"?"Restore":"Archive"}</button><button class="tiny-btn danger" data-action="delete-inbox-v3" data-id="${x.id}">Delete</button></div>
      </div></article>`).join(""):empty("📥","Your Trip Inbox is empty","Capture anything you want to sort out later.")}</div>`;
}

/* ---------- Itinerary power tools ---------- */
function renderPlan() {
  const menu=[["itinerary","🗓️","Itinerary"],["inbox","📥","Inbox"],["places","📍","Places"],["map","🗺️","Map"],["bookings","🎟️","Bookings"],["packing","🧳","Packing"],["before","✅","Before You Go"],["essentials","🆘","Essentials"]];
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">PLAN</p><h1>Plan your trip</h1><p>${esc(trip().title)}</p></div><button class="btn soft" data-action="open-quick-add">＋ Add</button></div><div class="chips">${menu.map(([k,e,l])=>`<button class="chip ${state.planView===k?"active":""}" data-action="set-plan-view" data-feature="${k}">${e} ${l}</button>`).join("")}</div><section class="section">${planHTML(state.planView)}</section>`;
}

function planHTML(v) {
  return v==="inbox"?inboxHTMLV3():v==="places"?placesHTML():v==="map"?mapHTMLV2():v==="bookings"?bookingsHTML():v==="packing"?packingHTML():v==="before"?beforeHTML():v==="essentials"?essentialsHTMLV2():itineraryHTML(state.activeItineraryDate||activeDate());
}

function itineraryHTML(date) {
  const t=trip();
  if(!allDates(t).includes(date))date=activeDate(t);
  state.activeItineraryDate=date;
  const items=activitiesOn(date,t),totalDuration=items.reduce((s,x)=>s+Number(x.duration||0),0),travel=items.reduce((s,x)=>s+Number(x.travelTime||0),0),collapsed=!!state.collapsedDays[`${t.id}:${date}`];
  return `<div class="section-title"><h3>🗓️ Itinerary</h3><div class="section-actions-v3"><button data-action="duplicate-day-v3" data-date="${date}">Duplicate day</button><button data-action="quick-add-type" data-type="activity">＋ Activity</button></div></div>
  <div class="chips">${allDates(t).map(d=>`<button class="chip ${d===date?"active":""}" data-action="show-itinerary-date-v3" data-date="${d}">Day ${dayNo(d,t)} · ${nice(d,{month:"short",day:"numeric"})}</button>`).join("")}</div>
  <div id="itineraryDay"><div class="day-summary day-summary-v3" data-action="toggle-day-collapse-v3" data-date="${date}" role="button" tabindex="0" aria-expanded="${!collapsed}"><div><strong>${items.length}</strong><small>activities</small></div><div><strong>${formatDuration(totalDuration)||"—"}</strong><small>planned</small></div><div><strong>${formatDuration(travel)||"—"}</strong><small>travel time</small></div><span>${collapsed?"Show":"Hide"} day</span></div>
  ${collapsed?`<div class="collapsed-day-v3">Day collapsed · ${items.length} activities</div>`:items.length?`<div data-itinerary-date="${date}">${items.map(i=>`${i.travelTime?`<div class="travel-block-v3">🚃 ${formatDuration(i.travelTime)} travel before next stop</div>`:""}${activityCardV2(i)}`).join("")}</div>`:empty("🗓️","Nothing planned yet","Add an activity to this day.","activity")}</div>`;
}

function activityCardV2(i) {
  return `<article class="itinerary-card ${i.completed?"activity-complete-v3":""}" data-activity-id="${i.id}" data-date="${i.date}">
    <button class="drag-handle" data-action="drag-activity-v2" data-id="${i.id}" aria-label="Drag ${esc(i.title)} to reorder">⋮⋮</button>
    <div class="activity-time">${i.flexible?"Anytime":esc(formatTimeV3(i.time||""))}</div>
    <div class="activity-main"><h4>${i.completed?"✓ ":""}${ICON[i.type]||"📍"} ${esc(i.title)}</h4><p>${esc(i.place||i.address||"")}${i.notes?` · ${esc(i.notes)}`:""}</p><div class="activity-meta">${i.duration?`<span class="badge gray">⏱ ${formatDuration(i.duration)}</span>`:""}${i.flexible?`<span class="badge gold">Flexible</span>`:""}${i.completed?`<span class="badge green">Done</span>`:""}</div>
      <div class="activity-actions"><button class="tiny-btn" data-action="move-activity-step-v3" data-id="${i.id}" data-step="-1" aria-label="Move activity earlier">↑</button><button class="tiny-btn" data-action="move-activity-step-v3" data-id="${i.id}" data-step="1" aria-label="Move activity later">↓</button><button class="tiny-btn" data-action="edit-activity-v2" data-id="${i.id}">Edit</button><button class="tiny-btn" data-action="duplicate-activity-v2" data-id="${i.id}">Duplicate</button><button class="tiny-btn" data-action="move-activity-v2" data-id="${i.id}">Move day</button>${(i.address||i.lat||i.place)?`<a class="tiny-btn" href="${esc(preferredMapUrlV3(i))}" target="_blank" rel="noopener">Map</a>`:""}<button class="tiny-btn danger" data-action="delete-v2" data-collection="itinerary" data-id="${i.id}">Delete</button></div>
    </div></article>`;
}

function duplicateDayModalV3(date) {
  openModal("Duplicate Day",`<form id="duplicateDayFormV3" data-source-date="${date}" class="form-grid"><div class="form-row"><label>COPY DAY ${dayNo(date)} TO</label><select name="targetDate">${allDates().filter(x=>x!==date).map(d=>`<option value="${d}">Day ${dayNo(d)} · ${nice(d)}</option>`).join("")}</select></div><p class="meta">Copies every activity with new IDs. Existing activities on the target day are kept.</p><button class="btn primary">Duplicate day</button></form>`);
}

/* ---------- Map 3.0 ---------- */
function preferredMapUrlV3(item, provider=state.settings?.mapApp||"apple") {
  const q=[item.name||item.title,item.address,item.area,trip().destination].filter(Boolean).join(" ");
  if(provider==="apple"){
    if(item.lat&&item.lng)return `https://maps.apple.com/?ll=${encodeURIComponent(`${item.lat},${item.lng}`)}&q=${encodeURIComponent(item.name||item.title||"Saved place")}`;
    return `https://maps.apple.com/?q=${encodeURIComponent(q)}`;
  }
  return mapsSearchUrl(item);
}

function mapHTMLV2() {
  const t=trip(), f=state.mapFilters;
  const cats=["All",...new Set(t.places.map(x=>x.category))];
  return `<div class="section-title"><h3>🗺️ Map View</h3><button data-action="locate-me-v2">◎ Locate me</button></div>
    <div class="map-filter-grid-v3"><label>SHOW<select id="mapSourceV3"><option value="all" ${f.source==="all"?"selected":""}>Places + itinerary</option><option value="places" ${f.source==="places"?"selected":""}>Saved places</option><option value="itinerary" ${f.source==="itinerary"?"selected":""}>Itinerary only</option></select></label><label>DAY<select id="mapDayV3"><option value="active" ${f.day==="active"?"selected":""}>Active / preview day</option><option value="all" ${f.day==="all"?"selected":""}>All days</option>${allDates(t).map(d=>`<option value="${d}" ${f.day===d?"selected":""}>Day ${dayNo(d,t)} · ${nice(d,{month:"short",day:"numeric"})}</option>`).join("")}</select></label><label>CATEGORY<select id="mapCategoryV3">${cats.map(c=>`<option ${f.category===c?"selected":""}>${esc(c)}</option>`).join("")}</select></label></div>
    <div class="map-shell"><div id="ichigoMap"></div>${!navigator.onLine?`<div class="map-overlay-note">Saved place details work offline, but map tiles need a connection unless your browser still has them cached.</div>`:""}</div><p class="inline-help">When a specific itinerary day is selected, Ichigo draws a simple line between mapped stops. It is a visual route, not turn-by-turn transit routing.</p>`;
}

function initIchigoMapV2() {
  const container=document.querySelector("#ichigoMap"); if(!container)return;
  if(typeof L==="undefined"){container.innerHTML=empty("🗺️","Map library unavailable","Reconnect to load the interactive map. Saved place details still work.");return}
  try{if(ichigoMapInstance){ichigoMapInstance.remove();ichigoMapInstance=null}}catch{}
  const t=trip(),f=state.mapFilters,chosenDay=f.day==="active"?activeDate(t):f.day;
  let places=t.places.filter(p=>p.lat&&p.lng && (f.category==="All"||p.category===f.category));
  let activities=t.itinerary.filter(a=>a.lat&&a.lng && (chosenDay==="all"||a.date===chosenDay));
  if(f.source==="places")activities=[]; if(f.source==="itinerary")places=[];
  const first=places[0]||activities[0],fallback=first?[first.lat,first.lng]:[35.6762,139.6503];
  ichigoMapInstance=L.map(container,{zoomControl:true,attributionControl:true}).setView(fallback,12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(ichigoMapInstance);
  const bounds=[];
  places.forEach(p=>{const m=L.marker([p.lat,p.lng]).addTo(ichigoMapInstance);m.bindPopup(`<strong>${esc(p.name)}</strong><br>${esc(p.area||p.category)}<br><a href="${esc(preferredMapUrlV3(p))}" target="_blank" rel="noopener">Open in ${state.settings.mapApp==="apple"?"Apple":"Google"} Maps</a>`);bounds.push([p.lat,p.lng])});
  activities.sort(activitySort).forEach(a=>{const m=L.circleMarker([a.lat,a.lng],{radius:8,color:"#ff4f78",fillColor:"#ff6f91",fillOpacity:.86}).addTo(ichigoMapInstance);m.bindPopup(`<strong>🍓 ${esc(a.title)}</strong><br>${esc(formatTimeV3(a.time))}<br><a href="${esc(preferredMapUrlV3(a))}" target="_blank" rel="noopener">Open map</a>`);bounds.push([a.lat,a.lng])});
  if(chosenDay!=="all"&&activities.length>1)L.polyline(activities.sort(activitySort).map(a=>[a.lat,a.lng]),{color:"#ff6f91",weight:4,opacity:.68,dashArray:"7 7"}).addTo(ichigoMapInstance);
  if(bounds.length>1)ichigoMapInstance.fitBounds(bounds,{padding:[25,25],maxZoom:15});
  setTimeout(()=>ichigoMapInstance?.invalidateSize(),80);
}

/* ---------- Today Mode 3.0 ---------- */
function timelineStateV3(date,t=trip()) {
  const items=activitiesOn(date,t), isToday=date===isoToday(), now=new Date(), nowMin=now.getHours()*60+now.getMinutes();
  let current=null,next=null;const overdue=[];
  if(!isToday){next=items.find(x=>!x.completed)||items[0]||null;return{items,current,next,overdue,isToday,nowMin}}
  for(const item of items){
    if(item.completed)continue;
    const start=minutesFromTime(item.time),end=start==null?null:start+Number(item.duration||60);
    if(start!=null&&nowMin>=start&&nowMin<end&&!current)current=item;
    else if(start!=null&&nowMin>=end)overdue.push(item);
    else if(start!=null&&nowMin<start&&!next)next=item;
  }
  if(!current&&!next)next=items.find(x=>!x.completed&&x.flexible)||null;
  return{items,current,next,overdue,isToday,nowMin};
}

function countdownLabelV3(item,nowMin) {
  if(!item?.time)return "Anytime";const start=minutesFromTime(item.time),diff=start-nowMin;if(diff<=0)return "Now";if(diff<60)return `in ${diff} min`;const h=Math.floor(diff/60),m=diff%60;return m?`in ${h}h ${m}m`:`in ${h}h`;
}

function renderToday() {
  const t=trip(),date=activeDate(t),ts=timelineStateV3(date,t),daily=spentDate(date,t),bookings=t.bookings.filter(b=>b.date===date).sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99"));
  const focus=ts.current||ts.next;
  main.innerHTML=`<section class="today-header"><p class="eyebrow" style="color:#8b3044!important">${esc(t.cityLabel||t.destination)} · DAY ${dayNo(date,t)}</p><h1>${nice(date,{weekday:"long",month:"long",day:"numeric"})}</h1><p>${ts.isToday?"Your live travel day":"Previewing Today Mode"}</p></section>
    ${focus?`<section class="card today-focus"><div class="badge ${ts.current?"green":""}">${ts.current?"HAPPENING NOW":"NEXT"}</div><div class="countdown">${ts.current?`${Math.max(1,Math.ceil((minutesFromTime(focus.time)+Number(focus.duration||60)-ts.nowMin)))} min left`:ts.isToday?countdownLabelV3(focus,ts.nowMin):"Up next"}</div><h3>${ICON[focus.type]||"📍"} ${esc(focus.title)}</h3><p>${esc(focus.place||focus.address||"")} · ${focus.flexible?"Anytime":esc(formatTimeV3(focus.time))}</p><div class="activity-actions"><button class="tiny-btn primary" data-action="arrived-v3" data-id="${focus.id}">📍 I'm here</button><button class="tiny-btn" data-action="complete-activity-v3" data-id="${focus.id}">✓ Done</button><a class="tiny-btn" href="${esc(preferredMapUrlV3(focus))}" target="_blank" rel="noopener">Map</a>${bookings.length?`<button class="tiny-btn" data-action="open-bookings-v3">🎟 Booking</button>`:""}</div></section>`:empty("🌸","A free day","Nothing is scheduled for this day yet.","activity")}
    ${ts.overdue.length?`<section class="notice-card danger" style="margin-top:10px"><span class="notice-icon">⏰</span><span><strong>${ts.overdue.length} unfinished item${ts.overdue.length===1?"":"s"} passed their planned time.</strong><p>You can mark them done or keep going — Ichigo won't change the itinerary automatically.</p></span></section>`:""}
    <section class="card" style="padding:16px;margin-top:12px"><div class="section-title"><h3>Today’s timeline</h3><span class="meta">${ts.items.filter(x=>x.completed).length}/${ts.items.length} done</span></div><div class="today-timeline-v3">${ts.items.length?ts.items.map(i=>`<article class="today-line-v3 ${i.completed?"done":""} ${ts.current?.id===i.id?"current":""}"><span>${i.flexible?"Anytime":esc(formatTimeV3(i.time))}</span><div><strong>${esc(i.title)}</strong><small>${esc(i.place||"")}</small></div><button class="tiny-btn" data-action="complete-activity-v3" data-id="${i.id}">${i.completed?"Undo":"Done"}</button></article>`).join(""):"<p class='meta'>No activities yet.</p>"}</div></section>
    <section class="card" style="padding:16px;margin-top:12px;background:linear-gradient(145deg,#fff,#fff0f3)"><div class="section-title"><h3>Today’s spending</h3><span>${money(daily)} / ${money(t.dailyBudget)}</span></div><div class="progress"><span style="width:${Math.min(100,t.dailyBudget?daily/t.dailyBudget*100:0)}%"></span></div></section>
    ${bookings.length?`<section class="section"><div class="section-title"><h3>🎟 Today’s bookings</h3><button data-action="open-bookings-v3">View all</button></div><div class="list">${bookingRows(bookings.slice(0,3))}</div></section>`:""}
    <section class="section"><div class="grid-3"><button class="btn soft" data-action="quick-add-type" data-type="expense">＋ Expense</button><button class="btn soft" data-action="open-feature" data-feature="converter">💱 Convert</button><button class="btn soft" data-action="today-essentials-v2">🆘 Essentials</button></div></section>`;
}

/* ---------- CRUD polish: bookings, essentials and travelers ---------- */
function bookingRows(arr) {
  return arr.map(b=>`<div class="list-row">${b.attachmentKey?fileSlot(b.attachmentKey,b.attachmentName?.toLowerCase().endsWith(".pdf")?"file":"image","booking-attachment"):`<div class="row-icon">${bookEmoji(b.type)}</div>`}<div class="row-main"><h4>${esc(b.title)}</h4><p>${nice(b.date)}${b.time?` · ${esc(formatTimeV3(b.time))}`:""}${b.endDate?` → ${nice(b.endDate)}`:""}</p><p>${esc(b.confirmation||"No confirmation")} ${b.address?`· ${esc(b.address)}`:""}</p></div><div class="row-trailing"><span class="pill">${esc(b.status||"Saved")}</span><div style="margin-top:5px"><button class="tiny-btn" data-action="edit-booking-v2" data-id="${b.id}">Edit</button></div>${b.address?`<div style="margin-top:5px"><a class="tiny-btn" href="${esc(preferredMapUrlV3({title:b.title,address:b.address}))}" target="_blank" rel="noopener">Map</a></div>`:""}${b.link?`<div style="margin-top:5px"><a class="tiny-btn" href="${esc(b.link)}" target="_blank" rel="noopener">Open</a></div>`:""}<div style="margin-top:5px"><button class="tiny-btn danger" data-action="delete-v2" data-collection="bookings" data-id="${b.id}">Delete</button></div></div></div>`).join("");
}

function contactFormHTMLV3(item={}) {return `<form id="contactFormV3" data-edit-id="${item.id||""}" class="form-grid"><div class="form-row"><label>NAME</label><input name="name" required value="${esc(item.name||"")}"></div><div class="form-row"><label>PHONE</label><input name="phone" required value="${esc(item.phone||"")}"></div><div class="form-row"><label>NOTE</label><input name="note" value="${esc(item.note||"")}"></div><button class="btn primary">Save contact</button></form>`}
function documentFormHTMLV3(item={}) {return `<form id="documentFormV3" data-edit-id="${item.id||""}" class="form-grid"><div class="form-row"><label>DOCUMENT</label><input name="name" required value="${esc(item.name||"")}"></div><div class="form-row"><label>REFERENCE / NOTE</label><textarea name="reference">${esc(item.reference||"")}</textarea></div><button class="btn primary">Save document</button></form>`}
function phraseFormHTMLV3(item={}) {return `<form id="phraseFormV3" data-edit-id="${item.id||""}" class="form-grid"><div class="form-row"><label>LOCAL LANGUAGE</label><input name="jp" required value="${esc(item.jp||"")}"></div><div class="form-row"><label>PRONUNCIATION</label><input name="romaji" value="${esc(item.romaji||"")}"></div><div class="form-row"><label>MEANING</label><input name="en" value="${esc(item.en||"")}"></div><button class="btn primary">Save phrase</button></form>`}

function essentialsHTMLV2() {
  const e=trip().essentials;
  return `<div class="section-title"><h3>🆘 Offline Travel Essentials</h3><button data-action="edit-essentials-v2">Edit</button></div><div class="notice-card success"><span class="notice-icon">✈️</span><span><strong>Designed for offline access</strong><p>Hotel, insurance, emergency contacts, document references and phrases stay with this trip on your device.</p></span></div><div class="essentials-grid" style="margin-top:10px"><div class="card essential-card"><h3>🏨 Stay</h3><div class="essential-value"><strong>${esc(e.hotelName||"No hotel saved")}</strong>${e.hotelAddress?`\n${esc(e.hotelAddress)}`:""}${e.hotelPhone?`\n☎ ${esc(e.hotelPhone)}`:""}</div></div><div class="card essential-card"><h3>🛡️ Insurance</h3><div class="essential-value"><strong>${esc(e.insuranceProvider||"No insurance saved")}</strong>${e.insurancePolicy?`\nPolicy: ${esc(e.insurancePolicy)}`:""}${e.insurancePhone?`\n☎ ${esc(e.insurancePhone)}`:""}</div></div><div class="card essential-card"><h3>🩺 Medical / safety notes</h3><div class="essential-value">${esc(e.medicalNotes||"No notes saved")}</div></div><div class="card essential-card"><h3>🚃 Transport notes</h3><div class="essential-value">${esc(e.transitNotes||"No notes saved")}</div></div></div>
  <section class="section"><div class="section-title"><h3>Emergency contacts</h3><button data-action="add-contact-v3">＋ Contact</button></div><div class="card" style="padding:8px 13px">${e.contacts.length?e.contacts.map(c=>`<div class="contact-row"><div class="row-icon">☎️</div><div class="row-main"><h4>${esc(c.name)}</h4><p>${esc(c.phone)} ${c.note?`· ${esc(c.note)}`:""}</p></div><button class="tiny-btn" data-action="edit-contact-v3" data-id="${c.id}">Edit</button><button class="tiny-btn danger" data-action="delete-essential-v2" data-kind="contacts" data-id="${c.id}">✕</button></div>`).join(""):`<div class="empty"><p>Add family, insurance or important contacts.</p></div>`}</div></section>
  <section class="section"><div class="section-title"><h3>Document references</h3><button data-action="add-document-v3">＋ Document</button></div><div class="list">${e.documents.length?e.documents.map(d=>`<div class="list-row"><div class="row-icon">📄</div><div class="row-main"><h4>${esc(d.name)}</h4><p>${esc(d.reference||"")}</p></div><button class="tiny-btn" data-action="edit-document-v3" data-id="${d.id}">Edit</button><button class="tiny-btn danger" data-action="delete-essential-v2" data-kind="documents" data-id="${d.id}">✕</button></div>`).join(""):empty("📄","No document references","Save non-sensitive reference notes you want offline.")}</div></section>
  <section class="section"><div class="section-title"><h3>Useful phrases</h3><button data-action="add-phrase-v3">＋ Phrase</button></div><div class="list">${e.phrases.length?e.phrases.map(p=>`<div class="phrase-card"><button style="all:unset;cursor:pointer;display:block;width:100%" data-action="copy-text-v2" data-text="${esc(p.jp)}"><div class="jp">${esc(p.jp)}</div><div class="romaji">${esc(p.romaji||"")}</div><div class="translation">${esc(p.en||"")}</div></button><div class="activity-actions"><button class="tiny-btn" data-action="edit-phrase-v3" data-id="${p.id}">Edit</button><button class="tiny-btn danger" data-action="delete-essential-v2" data-kind="phrases" data-id="${p.id}">Delete</button></div></div>`).join(""):empty("💬","No phrases saved","Add useful phrases for offline access.")}</div></section>`;
}

function travelerFormHTMLV3(item={}) {return `<form id="travelerFormV3" data-edit-id="${item.id||""}" class="form-grid"><div class="form-row"><label>NAME</label><input name="name" required value="${esc(item.name||"")}"></div><div class="form-row two"><div><label>EMOJI</label><input name="emoji" value="${esc(item.emoji||"🙂")}"></div><div><label>ROLE</label><select name="role"><option ${item.role==="Owner"?"selected":""}>Owner</option><option ${item.role!=="Owner"?"selected":""}>Member</option></select></div></div><button class="btn primary">Save traveler</button></form>`}

function renderTogether() {
  const t=trip(),matches=t.places.filter(p=>{const v=Object.values(p.votes||{});return v.length&&t.travelers.length<=v.length&&v.every(x=>["❤️","👍"].includes(x))});
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">TOGETHER</p><h1>Travel Together</h1><p>Plan, vote and split expenses</p></div><button class="btn soft" data-action="add-traveler-v3">＋ Traveler</button></div><section class="section"><div class="section-title"><h3>Travelers</h3></div><div class="card" style="padding:8px 13px">${t.travelers.map(x=>`<div class="list-row" style="border:0"><div class="row-icon">${x.emoji||"🙂"}</div><div class="row-main"><h4>${esc(x.name)}</h4><p>${esc(x.role)}</p></div><button class="tiny-btn" data-action="edit-traveler-v3" data-id="${x.id}">Edit</button>${t.travelers.length>1?`<button class="tiny-btn danger" data-action="delete-traveler-v3" data-id="${x.id}">Delete</button>`:""}</div>`).join("")}</div></section><section class="section"><div class="section-title"><h3>💗 Group Picks</h3><span class="meta">${matches.length} matches</span></div><div class="list">${matches.length?matches.map(p=>`<div class="list-row"><div class="row-icon">${categoryEmoji(p.category)}</div><div class="row-main"><h4>${esc(p.name)}</h4><p>${esc(p.area)} · everyone is interested</p></div><span>💗</span></div>`).join(""):empty("💗","No group matches yet","Vote on saved places to discover shared favorites.")}</div></section><section class="section">${splitHTML()}</section>`;
}

/* ---------- Trip customization + settings ---------- */
function themeOptionsV3(selected) {return `<option value="inherit" ${selected==="inherit"?"selected":""}>Use app theme</option>${(window.ICHIGO_DATA?.themePresets||[]).map(x=>`<option value="${x.id}" ${selected===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}`}

function infoHTML() {
  const t=trip();
  return `<div class="card" style="padding:16px"><div class="form-grid"><div class="form-row"><label>TRIP NAME</label><input id="infoTitleV3" value="${esc(t.title)}"></div><div class="form-row two"><div><label>DESTINATION</label><input id="infoDestinationV3" value="${esc(t.destination)}"></div><div><label>FLAG / EMOJI</label><input id="infoEmojiV3" value="${esc(t.countryEmoji||"✈️")}"></div></div><div class="form-row two"><div><label>START</label><input id="infoStartV3" type="date" value="${t.startDate}"></div><div><label>END</label><input id="infoEndV3" type="date" value="${t.endDate}"></div></div><div class="form-row two"><div><label>BASE CURRENCY</label><select id="infoCurrencyV3">${currencyOptions(t.baseCurrency)}</select></div><div><label>HOME CURRENCY</label><select id="infoHomeCurrencyV3">${currencyOptions(t.homeCurrency)}</select></div></div><div class="form-row two"><div><label>TRIP THEME</label><select id="infoThemeV3">${themeOptionsV3(t.theme)}</select></div><div><label>CUSTOM ACCENT</label><input id="infoAccentV3" type="color" value="${/^#[0-9a-f]{6}$/i.test(t.accentColor)?t.accentColor:"#ff6f91"}"></div></div><label class="check-inline-v3"><input id="useCustomAccentV3" type="checkbox" ${t.accentColor?"checked":""}> Use this custom accent for the trip</label><button class="btn primary" data-action="save-trip-info-v3">Save trip info</button></div></div>
  <div class="card" style="padding:16px;margin-top:10px"><div class="section-title"><h3>Trip cover</h3><span class="meta">used on your Travel Shelf</span></div>${t.coverKey?`<div class="shelf-cover" style="border-radius:17px;margin-bottom:9px"><div class="shelf-cover-photo" data-file-key="${t.coverKey}"></div></div>`:""}<input id="tripCoverInputV2" type="file" accept="image/*"><button class="btn soft full" style="margin-top:8px" data-action="save-cover-v2">Save cover photo</button></div>`;
}

function settingsHTML() {
  const s=state.settings,n=s.notifications||{};
  return `<div class="settings-stack-v3">
    <section class="card settings-card-v3"><div class="section-title"><h3>⚙️ App preferences</h3></div><form id="settingsFormV3" class="form-grid"><div class="form-row two"><div><label>YOUR NAME</label><input name="travelerName" value="${esc(s.travelerName)}"></div><div><label>HOME COUNTRY</label><input name="homeCountry" value="${esc(s.homeCountry)}"></div></div><div class="form-row two"><div><label>HOME CURRENCY</label><select name="homeCurrency">${currencyOptions(s.homeCurrency)}</select></div><div><label>DEFAULT TRIP CURRENCY</label><select name="defaultTripCurrency">${currencyOptions(s.defaultTripCurrency)}</select></div></div><div class="form-row two"><div><label>DATE FORMAT</label><select name="dateFormat">${(window.ICHIGO_DATA?.dateFormats||[]).map(x=>`<option value="${x.id}" ${s.dateFormat===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div><div><label>TIME FORMAT</label><select name="timeFormat">${(window.ICHIGO_DATA?.timeFormats||[]).map(x=>`<option value="${x.id}" ${s.timeFormat===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div></div><div class="form-row two"><div><label>PREFERRED MAP</label><select name="mapApp">${(window.ICHIGO_DATA?.mapApps||[]).map(x=>`<option value="${x.id}" ${s.mapApp===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div><div><label>APP THEME</label><select name="theme">${(window.ICHIGO_DATA?.themePresets||[]).map(x=>`<option value="${x.id}" ${s.theme===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div></div><button class="btn primary">Save preferences</button></form></section>

    <section class="card settings-card-v3"><div class="section-title"><h3>🔔 Reminders</h3><span class="meta">while Ichigo is open</span></div><p class="meta">Web PWAs can show reminders while the app is running. Closed-app scheduling on iPhone requires push/native support, which is intentionally not faked in Build 3.</p><div class="form-row two"><div><label>ACTIVITY LEAD</label><select id="activityLeadV3">${(window.ICHIGO_DATA?.reminderLeadOptions||[]).map(x=>`<option value="${x}" ${Number(n.activityLead)===x?"selected":""}>${x} min</option>`).join("")}</select></div><div><label>BOOKING LEAD</label><select id="bookingLeadV3">${(window.ICHIGO_DATA?.reminderLeadOptions||[]).map(x=>`<option value="${x}" ${Number(n.bookingLead)===x?"selected":""}>${x} min</option>`).join("")}</select></div></div><div class="btn-row" style="margin-top:9px"><button class="btn soft" data-action="enable-notifications-v3">Enable reminders</button><button class="btn" data-action="save-reminder-settings-v3">Save reminder timing</button></div><p class="inline-help">Permission: <strong>${window.Notification?.permission||"not supported"}</strong></p></section>

    <section class="card settings-card-v3"><div class="section-title"><h3>💾 Full backup & restore</h3></div><p class="meta">Build 3 backups include trip data plus IndexedDB photos, receipts, covers and attachments.</p><div class="btn-row"><button class="btn soft" data-action="export-full-backup-v3">Export full backup</button><button class="btn" data-action="import-full-backup-v3">Restore backup</button></div><input id="importFullBackupV3" type="file" accept="application/json" hidden><div class="storage-line-v3"><span>Local files</span><strong id="dbStatsV3">Checking…</strong></div><div class="storage-line-v3"><span>Browser storage</span><strong id="storageEstimateV3">Checking…</strong></div></section>

    <section class="card settings-card-v3"><div class="section-title"><h3>⬆️ App updates</h3></div><p class="meta">Ichigo checks the service worker for a newer GitHub Pages build and shows an update banner when one is ready.</p><div class="btn-row"><button class="btn soft" data-action="force-update-check-v3">Check for update</button><button class="btn" data-action="install-app">Install Ichigo</button></div></section>

    <section class="card settings-card-v3"><div class="section-title"><h3>🧪 Testing & debug</h3></div><div class="diagnostic-grid-v3"><span>App</span><strong>${APP_VERSION_V3}</strong><span>Schema</span><strong>v${APP_SCHEMA_VERSION_V3}</strong><span>Cache</span><strong>${CACHE_VERSION_V3}</strong><span>Network</span><strong>${navigator.onLine?"Online":"Offline"}</strong><span>Notifications</span><strong>${window.Notification?.permission||"N/A"}</strong></div><div class="btn-row wrap-v3" style="margin-top:10px"><button class="btn soft" data-action="run-selftest-v3">Run self-test</button><button class="btn" data-action="copy-diagnostics-v3">Copy diagnostics</button><button class="btn" data-action="clear-caches-v3">Clear app caches</button></div></section>

    <section class="card settings-card-v3"><button class="btn danger full" data-action="reset-demo">Reset all local data</button></section>
  </div>`;
}

function tripFormHTMLV3() {
  const s=state.settings;return `<form id="tripFormV3" class="form-grid"><div class="form-row"><label>TRIP NAME</label><input name="title" required placeholder="Seoul 2027"></div><div class="form-row"><label>DESTINATION</label><input name="destination" required></div><div class="form-row two"><div><label>START</label><input name="startDate" type="date" required></div><div><label>END</label><input name="endDate" type="date" required></div></div><div class="form-row two"><div><label>FLAG / EMOJI</label><input name="countryEmoji" value="✈️"></div><div><label>CURRENCY</label><select name="baseCurrency">${currencyOptions(s.defaultTripCurrency)}</select></div></div><button class="btn primary">Create trip</button></form>`;
}
function newTrip(){openModal("Create Trip",tripFormHTMLV3())}

/* ---------- Foreground reminders ---------- */
function reminderLogV3(){try{return JSON.parse(localStorage.getItem(REMINDER_LOG_V3)||"{}") }catch{return{}}}
function rememberReminderV3(key){const log=reminderLogV3();log[key]=Date.now();const cutoff=Date.now()-14*86400000;Object.keys(log).forEach(k=>{if(log[k]<cutoff)delete log[k]});localStorage.setItem(REMINDER_LOG_V3,JSON.stringify(log))}
function minutesToV3(date,time){if(!date||!time)return null;const [h,m]=time.split(":").map(Number),d=parseDate(date);d.setHours(h,m,0,0);return Math.round((d-Date.now())/60000)}
function sendReminderV3(key,title,body){if(reminderLogV3()[key])return;rememberReminderV3(key);if(window.Notification?.permission==="granted"){try{new Notification(title,{body,icon:"./icons/icon-192.png",tag:key})}catch{notify(body)}}else notify(body)}
function checkRemindersV3(){const s=state.settings?.notifications;if(!s?.enabled)return;const t=trip();t.itinerary.filter(x=>!x.completed&&x.date&&x.time).forEach(x=>{const mins=minutesToV3(x.date,x.time),lead=Number(x.reminderLead??s.activityLead);if(mins!=null&&mins<=lead&&mins>=0)sendReminderV3(`${t.id}:activity:${x.id}:${x.date}`,"Ichigo · Activity soon",`${x.title} starts ${mins<=1?"now":`in ${mins} minutes`}.`) });t.bookings.filter(x=>x.date&&x.time).forEach(x=>{const mins=minutesToV3(x.date,x.time),lead=Number(x.reminderLead??s.bookingLead);if(mins!=null&&mins<=lead&&mins>=0)sendReminderV3(`${t.id}:booking:${x.id}:${x.date}`,"Ichigo · Booking soon",`${x.title} is ${mins<=1?"now":`in ${mins} minutes`}.`) });if(s.taskDue)t.preTrip.filter(x=>!x.done&&x.dueDate===isoToday()).forEach(x=>sendReminderV3(`${t.id}:task:${x.id}:${x.dueDate}`,"Ichigo · Task due",x.name))}
function startReminderEngineV3(){if(reminderTimerV3)return;checkRemindersV3();reminderTimerV3=setInterval(checkRemindersV3,30000)}

/* ---------- Full backup ---------- */
async function exportFullBackupV3(){try{notify("Preparing backup…");const files=await IchigoDB.exportAll();const payload={format:"ichigo-full-backup",backupVersion:1,appVersion:APP_VERSION_V3,schemaVersion:APP_SCHEMA_VERSION_V3,exportedAt:new Date().toISOString(),state,files};download(`ichigo-full-backup-${isoToday()}.json`,JSON.stringify(payload));notify(`Backup ready · ${files.length} local file${files.length===1?"":"s"}`)}catch(err){console.error(err);notify("Backup couldn't be created.")}}
async function restoreFullBackupV3(file){try{const payload=JSON.parse(await file.text());if(payload.format!=="ichigo-full-backup"||!payload.state)throw Error("Invalid Ichigo backup");if(!confirm("Restore this backup? Current local Ichigo data and stored images will be replaced."))return;state=payload.state;ensureStateV3();state.trips=(state.trips||[]).map(ensureTripV3);await IchigoDB.importAll(payload.files||[],{clearFirst:true});save();render();notify("Ichigo backup restored ✓")}catch(err){console.error(err);alert("That file is not a valid Ichigo full backup.")}}

async function updateStorageDiagnosticsV3(){if(state.currentView!=="trip"||state.tripView!=="settings")return;try{const s=await IchigoDB.stats(),el=document.querySelector("#dbStatsV3");if(el)el.textContent=`${s.count} files · ${formatBytesV3(s.bytes)}`}catch{}try{const est=await navigator.storage?.estimate?.(),el=document.querySelector("#storageEstimateV3");if(el&&est)el.textContent=`${formatBytesV3(est.usage||0)} used${est.quota?` / ${formatBytesV3(est.quota)}`:""}`}catch{}}
function formatBytesV3(n){n=Number(n||0);if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;if(n<1073741824)return`${(n/1048576).toFixed(1)} MB`;return`${(n/1073741824).toFixed(1)} GB`}

/* ---------- Service-worker update UI ---------- */
function showUpdateBannerV3(reg){
  pendingSWRegistrationV3=reg;
  const host=document.querySelector("#appUpdateHost");
  if(!host||host.querySelector(".update-banner-v3"))return;
  host.innerHTML=`<div class="update-banner-v3">
    <span class="update-copy-v74"><strong>An update is available.</strong><small>Refresh to update.</small></span>
    <button class="update-button-v74" data-action="apply-update-v3">Update</button>
  </div>`;
}
async function setupServiceWorkerUpdatesV3(){if(!("serviceWorker" in navigator))return;try{const reg=await navigator.serviceWorker.getRegistration();if(!reg)return;if(reg.waiting)showUpdateBannerV3(reg);reg.addEventListener("updatefound",()=>{const w=reg.installing;if(!w)return;w.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)showUpdateBannerV3(reg)})});navigator.serviceWorker.addEventListener("controllerchange",()=>{if(reloadForUpdateV3)return;reloadForUpdateV3=true;location.reload()})}catch(err){console.warn(err)}}

/* ---------- Onboarding ---------- */
const ONBOARDING_V3=[
  ["🍓","Welcome to Ichigo","Your trip changes with you: plan it, use Today Mode while traveling, then keep it as a scrapbook."],
  ["📥","Start messy on purpose","Throw links, screenshots and random ideas into Trip Inbox. Organize them later."],
  ["🌸","Today Mode is your travel screen","Current plan, next stop, spending, map and essentials stay close while you're moving."],
  ["📚","Trips become keepsakes","Afterward, Memories, Scrapbook, Trip Recap and your Travel Shelf keep old trips useful."]
];
function onboardingHTMLV3(step){const [emoji,title,text]=ONBOARDING_V3[step];return `<div class="onboarding-v3"><div class="onboarding-emoji-v3">${emoji}</div><p class="eyebrow">STEP ${step+1} OF ${ONBOARDING_V3.length}</p><h2>${title}</h2><p>${text}</p><div class="onboarding-dots-v3">${ONBOARDING_V3.map((_,i)=>`<i class="${i===step?"active":""}"></i>`).join("")}</div><div class="btn-row"><button class="btn" data-action="onboarding-skip-v3">Skip</button><button class="btn primary" data-action="onboarding-next-v3" data-step="${step}">${step===ONBOARDING_V3.length-1?"Start planning":"Next"}</button></div></div>`}
function maybeShowOnboardingV3(){if(onboardingShownV3||state.onboarding?.completed||modalRoot.firstElementChild)return;onboardingShownV3=true;setTimeout(()=>openModal("Welcome to Ichigo",onboardingHTMLV3(Number(state.onboarding?.step||0))),120)}

/* ---------- Debug ---------- */
async function diagnosticsV3(){const fileStats=await IchigoDB.stats().catch(()=>({count:-1,bytes:0})),cacheKeys=await caches.keys().catch(()=>[]),reg=await Promise.resolve(navigator.serviceWorker?.getRegistration?.()).catch(()=>null),storage=await Promise.resolve(navigator.storage?.estimate?.()).catch(()=>null);return{appVersion:APP_VERSION_V3,schemaVersion:state.schemaVersion,tripCount:state.trips.length,currentTrip:trip().title,online:navigator.onLine,notificationPermission:window.Notification?.permission||"unsupported",serviceWorker:reg?{active:!!reg.active,waiting:!!reg.waiting,installing:!!reg.installing}:"none",caches:cacheKeys,files:fileStats,storage,platform:navigator.userAgent,generatedAt:new Date().toISOString()}}
async function runSelfTestV3(){const tests=[];const add=(name,ok,detail="")=>tests.push({name,ok,detail});try{add("Structured state",Array.isArray(state.trips)&&!!trip().id,`${state.trips.length} trip(s)`)}catch(e){add("Structured state",false,e.message)}try{await IchigoDB.open();add("IndexedDB",true,`DB v${IchigoDB.DB_VERSION}`)}catch(e){add("IndexedDB",false,e.message)}try{const reg=await navigator.serviceWorker?.getRegistration?.();add("Service worker",!!reg,reg?.active?"Active":"Not active yet")}catch(e){add("Service worker",false,e.message)}try{const response=await fetch("./manifest.json",{cache:"no-store"});add("Manifest",response.ok,`HTTP ${response.status}`)}catch(e){add("Manifest",false,"Unavailable offline or fetch failed")}add("Current trip arrays",[trip().itinerary,trip().places,trip().bookings,trip().expenses,trip().memories,trip().inbox].every(Array.isArray),"Core collections readable");openModal("Ichigo Self-Test",`<div class="selftest-v3">${tests.map(x=>`<div class="selftest-row-v3 ${x.ok?"pass":"fail"}"><span>${x.ok?"✓":"!"}</span><div><strong>${esc(x.name)}</strong><small>${esc(x.detail)}</small></div></div>`).join("")}</div>`) }

/* ---------- Launch shortcuts ---------- */
function applyLaunchShortcut(){const shortcut=location.hash.replace("#","").toLowerCase();if(shortcut==="today")state.currentView="today";if(shortcut==="expense"){state.currentView="spend";state.spendView="expenses";setTimeout(()=>quick("expense"),120)}if(shortcut==="inbox"){state.currentView="plan";state.planView="inbox"}if(shortcut==="search")state.launchActionV3="search";if(shortcut)history.replaceState(null,"",location.pathname+location.search)}

/* ---------- Build 3 actions ---------- */
document.addEventListener("click",async event=>{
  const el=event.target.closest("[data-action]");if(!el)return;const a=el.dataset.action,t=trip();
  if(a==="open-search-v3")openSearchV3();
  if(a==="search-result-v3")goToSearchResultV3(el.dataset.kind);
  if(a==="add-inbox-v3")openModal("Add to Trip Inbox",inboxFormHTMLV3());
  if(a==="edit-inbox-v3"){const x=t.inbox.find(i=>i.id===el.dataset.id);if(x)openModal("Edit Inbox Item",inboxFormHTMLV3(x))}
  if(a==="archive-inbox-v3"){const x=t.inbox.find(i=>i.id===el.dataset.id);if(x)x.status=x.status==="archived"?"inbox":"archived";save();render()}
  if(a==="delete-inbox-v3"){const x=t.inbox.find(i=>i.id===el.dataset.id);if(!x||!confirm("Delete this inbox item?"))return;if(x.fileKey)await IchigoDB.remove(x.fileKey).catch(()=>{});t.inbox=t.inbox.filter(i=>i.id!==x.id);save();render()}
  if(a==="convert-inbox-place-v3"){const x=t.inbox.find(i=>i.id===el.dataset.id);if(x){t.places.push(ensureTripV2({places:[{id:uuid(),name:x.title,area:"",category:x.type==="Food"?"Restaurant":"Other",notes:x.note,mapUrl:x.url,votes:{},visited:false}],itinerary:[],bookings:[],packing:[],preTrip:[],expenses:[],memories:[],travelers:[],startDate:t.startDate,endDate:t.endDate,totalBudget:0,destination:t.destination,title:"tmp"}).places[0]);x.status="archived";state.planView="places";save();render();notify("Moved into Places ✓")}}
  if(a==="convert-inbox-activity-v3"){const x=t.inbox.find(i=>i.id===el.dataset.id);if(x){t.itinerary.push({id:uuid(),date:state.activeItineraryDate||activeDate(t),time:"",duration:60,travelTime:0,type:"place",title:x.title,place:"",address:"",notes:[x.note,x.url].filter(Boolean).join(" · "),flexible:true,order:activitiesOn(state.activeItineraryDate||activeDate(t),t).length,lat:null,lng:null,completed:false});x.status="archived";state.planView="itinerary";save();render();notify("Moved into Itinerary ✓")}}
  if(a==="show-itinerary-date-v3"){state.activeItineraryDate=el.dataset.date;save();render()}
  if(a==="toggle-day-collapse-v3"){const key=`${t.id}:${el.dataset.date}`;state.collapsedDays[key]=!state.collapsedDays[key];save();render()}
  if(a==="duplicate-day-v3")duplicateDayModalV3(el.dataset.date);
  if(a==="move-activity-step-v3"){const day=activitiesOn(t.itinerary.find(x=>x.id===el.dataset.id)?.date||"",t),idx=day.findIndex(x=>x.id===el.dataset.id),target=idx+Number(el.dataset.step);if(idx>=0&&target>=0&&target<day.length){[day[idx],day[target]]=[day[target],day[idx]];day.forEach((x,i)=>x.order=i);save();render()}}
  if(a==="arrived-v3"){const item=t.itinerary.find(x=>x.id===el.dataset.id);if(item){item.arrivedAt=new Date().toISOString();const words=`${item.title} ${item.place}`.toLowerCase();const p=t.places.find(p=>words.includes(p.name.toLowerCase())||`${p.name} ${p.area}`.toLowerCase().includes((item.place||"").toLowerCase()));if(p)p.visited=true;save();render();notify("Marked as arrived 📍")}}
  if(a==="complete-activity-v3"){const item=t.itinerary.find(x=>x.id===el.dataset.id);if(item){item.completed=!item.completed;item.completedAt=item.completed?new Date().toISOString():"";save();render()}}
  if(a==="open-bookings-v3"){state.currentView="plan";state.planView="bookings";save();render()}
  if(a==="add-traveler-v3")openModal("Add Traveler",travelerFormHTMLV3());
  if(a==="edit-traveler-v3"){const x=t.travelers.find(i=>i.id===el.dataset.id);if(x)openModal("Edit Traveler",travelerFormHTMLV3(x))}
  if(a==="delete-traveler-v3"){if(t.travelers.length<=1)return;const id=el.dataset.id;if(confirm("Remove this traveler from the trip?")){t.travelers=t.travelers.filter(x=>x.id!==id);save();render()}}
  if(a==="add-contact-v3")openModal("Add Emergency Contact",contactFormHTMLV3());
  if(a==="edit-contact-v3"){const x=t.essentials.contacts.find(i=>i.id===el.dataset.id);if(x)openModal("Edit Contact",contactFormHTMLV3(x))}
  if(a==="add-document-v3")openModal("Add Document Reference",documentFormHTMLV3());
  if(a==="edit-document-v3"){const x=t.essentials.documents.find(i=>i.id===el.dataset.id);if(x)openModal("Edit Document",documentFormHTMLV3(x))}
  if(a==="add-phrase-v3")openModal("Add Phrase",phraseFormHTMLV3());
  if(a==="edit-phrase-v3"){const x=t.essentials.phrases.find(i=>i.id===el.dataset.id);if(x)openModal("Edit Phrase",phraseFormHTMLV3(x))}
  if(a==="save-trip-info-v3"){t.title=document.querySelector("#infoTitleV3").value.trim()||t.title;t.destination=document.querySelector("#infoDestinationV3").value.trim()||t.destination;t.countryEmoji=document.querySelector("#infoEmojiV3").value.trim()||"✈️";t.startDate=document.querySelector("#infoStartV3").value||t.startDate;t.endDate=document.querySelector("#infoEndV3").value||t.endDate;t.baseCurrency=document.querySelector("#infoCurrencyV3").value;t.homeCurrency=document.querySelector("#infoHomeCurrencyV3").value;t.theme=document.querySelector("#infoThemeV3").value;t.accentColor=document.querySelector("#useCustomAccentV3").checked?document.querySelector("#infoAccentV3").value:"";save();render();notify("Trip customization saved ✓")}
  if(a==="enable-notifications-v3"){if(!window.Notification){notify("Notifications aren't supported in this browser.");return}const p=await Notification.requestPermission();state.settings.notifications.enabled=p==="granted";save();notify(p==="granted"?"Reminders enabled ✓":"Notification permission wasn't granted.")}
  if(a==="save-reminder-settings-v3"){state.settings.notifications.activityLead=Number(document.querySelector("#activityLeadV3")?.value||15);state.settings.notifications.bookingLead=Number(document.querySelector("#bookingLeadV3")?.value||60);save();notify("Reminder timing saved")}
  if(a==="export-full-backup-v3")await exportFullBackupV3();
  if(a==="import-full-backup-v3")document.querySelector("#importFullBackupV3")?.click();
  if(a==="force-update-check-v3"){const reg=await navigator.serviceWorker?.getRegistration?.();if(reg){await reg.update();if(reg.waiting)showUpdateBannerV3(reg);else notify("Ichigo checked for updates.")}else notify("No service worker registration found.")}
  if(a==="apply-update-v3"){const reg=pendingSWRegistrationV3||await navigator.serviceWorker?.getRegistration?.();if(reg?.waiting){reloadForUpdateV3=false;reg.waiting.postMessage({type:"SKIP_WAITING"});notify("Updating Ichigo…")}}
  if(a==="run-selftest-v3")await runSelfTestV3();
  if(a==="copy-diagnostics-v3"){await copyTextV2(JSON.stringify(await diagnosticsV3(),null,2));notify("Diagnostics copied ✓")}
  if(a==="clear-caches-v3"){if(confirm("Clear Ichigo's service-worker caches? Your saved trip data and photos will not be deleted.")){for(const k of await caches.keys())if(k.startsWith("ichigo-"))await caches.delete(k);notify("App caches cleared. Reload to fetch fresh files.")}}
  if(a==="onboarding-skip-v3"){state.onboarding.completed=true;save();closeModal()}
  if(a==="onboarding-next-v3"){const step=Number(el.dataset.step||0);if(step>=ONBOARDING_V3.length-1){state.onboarding.completed=true;state.onboarding.step=0;save();closeModal();notify("Welcome to Ichigo 🍓")}else{state.onboarding.step=step+1;save();modalRoot.querySelector("#modalBody").innerHTML=onboardingHTMLV3(step+1)}}
});

document.addEventListener("input",event=>{if(event.target.id==="globalSearchV3"){const results=document.querySelector("#globalSearchResultsV3");if(results)results.innerHTML=searchResultsHTMLV3(event.target.value)}});
document.addEventListener("change",async event=>{const x=event.target;if(["mapSourceV3","mapDayV3","mapCategoryV3"].includes(x.id)){if(x.id==="mapSourceV3")state.mapFilters.source=x.value;if(x.id==="mapDayV3")state.mapFilters.day=x.value;if(x.id==="mapCategoryV3")state.mapFilters.category=x.value;save();initIchigoMapV2()}if(x.id==="importFullBackupV3"&&x.files?.[0])await restoreFullBackupV3(x.files[0])});

document.addEventListener("submit",async event=>{
  const f=event.target;if(!f.id?.endsWith("V3"))return;event.preventDefault();const d=Object.fromEntries(new FormData(f).entries()),t=trip(),editId=f.dataset.editId||"";
  if(f.id==="inboxFormV3"){const old=editId?t.inbox.find(x=>x.id===editId):null,item=old||{id:uuid(),status:"inbox",createdAt:Date.now(),fileKey:""};const input=f.querySelector('[name="attachment"]');if(input?.files?.[0]){try{const blob=await IchigoDB.compressImage(input.files[0],1400,.78);if(item.fileKey)await IchigoDB.remove(item.fileKey);item.fileKey=await IchigoDB.put(blob,{name:input.files[0].name,kind:"inbox"})}catch{notify("Screenshot couldn't be stored, but the inbox item will be saved.")}}Object.assign(item,{type:d.type,title:d.title.trim(),url:d.url.trim(),note:d.note.trim()});if(!old)t.inbox.push(item);save();closeModal();state.currentView="plan";state.planView="inbox";save();render();notify(editId?"Inbox item updated":"Saved to Trip Inbox")}
  if(f.id==="duplicateDayFormV3"){const src=f.dataset.sourceDate,target=d.targetDate,copies=activitiesOn(src,t).map((x,i)=>({...clone(x),id:uuid(),date:target,order:activitiesOn(target,t).length+i,completed:false,completedAt:"",arrivedAt:""}));t.itinerary.push(...copies);renumberDay(target,t);state.activeItineraryDate=target;save();closeModal();render();notify(`Copied ${copies.length} activities to Day ${dayNo(target,t)}`)}
  if(f.id==="travelerFormV3"){const old=editId?t.travelers.find(x=>x.id===editId):null,item=old||{id:uuid()};Object.assign(item,{name:d.name.trim(),emoji:d.emoji.trim()||"🙂",role:d.role});if(!old)t.travelers.push(item);save();closeModal();render();notify(editId?"Traveler updated":"Traveler added")}
  if(f.id==="contactFormV3"){const old=editId?t.essentials.contacts.find(x=>x.id===editId):null,item=old||{id:uuid()};Object.assign(item,{name:d.name.trim(),phone:d.phone.trim(),note:d.note.trim()});if(!old)t.essentials.contacts.push(item);save();closeModal();render()}
  if(f.id==="documentFormV3"){const old=editId?t.essentials.documents.find(x=>x.id===editId):null,item=old||{id:uuid()};Object.assign(item,{name:d.name.trim(),reference:d.reference.trim()});if(!old)t.essentials.documents.push(item);save();closeModal();render()}
  if(f.id==="phraseFormV3"){const old=editId?t.essentials.phrases.find(x=>x.id===editId):null,item=old||{id:uuid()};Object.assign(item,{jp:d.jp.trim(),romaji:d.romaji.trim(),en:d.en.trim()});if(!old)t.essentials.phrases.push(item);save();closeModal();render()}
  if(f.id==="settingsFormV3"){state.settings.travelerName=d.travelerName.trim();state.settings.homeCountry=d.homeCountry.trim();state.settings.homeCurrency=d.homeCurrency;state.settings.defaultTripCurrency=d.defaultTripCurrency;state.settings.dateFormat=d.dateFormat;state.settings.timeFormat=d.timeFormat;state.settings.mapApp=d.mapApp;state.settings.theme=d.theme;save();applyAppearanceV3();render();notify("Preferences saved")}
  if(f.id==="tripFormV3"){const n=ensureTripV3({id:uuid(),title:d.title.trim(),destination:d.destination.trim(),cityLabel:d.destination.toUpperCase(),countryEmoji:d.countryEmoji||"✈️",startDate:d.startDate,endDate:d.endDate,baseCurrency:d.baseCurrency,homeCurrency:state.settings.homeCurrency,totalBudget:0,dailyBudget:0,categoryBudgets:{},coverKey:"",theme:"inherit",accentColor:"",travelers:[],itinerary:[],places:[],bookings:[],packing:[],preTrip:[],expenses:[],memories:[],inbox:[]});state.trips.push(n);state.currentTripId=n.id;state.currentView="home";save();closeModal();render();notify("New trip created 🍓")}
});


/* Build 3 owns reminder behavior; disable the older one-shot notifier. */
function checkTaskRemindersV2() {}

function beforeHTML() {
  const t=trip(), sorted=[...t.preTrip].sort((a,b)=>Number(a.done)-Number(b.done)||(a.dueDate||"9999").localeCompare(b.dueDate||"9999")||taskPriorityWeight(a.priority)-taskPriorityWeight(b.priority));
  const due=dueTasks(t);
  return `<div class="section-title"><h3>✅ Before You Go</h3><button data-action="quick-add-type" data-type="task">＋ Task</button></div>
  <div class="btn-row" style="margin-bottom:9px"><button class="btn soft" data-action="pretrip-template-v2">Add starter checklist</button><button class="btn" data-action="enable-notifications-v3">🔔 Reminders</button></div>
  ${due.length?`<div class="notice-card danger budget-warning"><span class="notice-icon">⏰</span><span><strong>${due.length} task${due.length===1?"":"s"} due or overdue</strong><p>Build 3 can also remind you while Ichigo is open when notifications are enabled.</p></span></div>`:""}
  <div class="card" style="padding:13px 15px">${sorted.length?sorted.map(i=>`<label class="check-row ${i.done?"done":""}"><input type="checkbox" ${i.done?"checked":""} data-action="toggle-pretrip" data-id="${i.id}"><span><span class="check-name">${esc(i.name)}</span><small style="display:block;color:var(--muted);margin-top:2px">${esc(i.category)} · <span class="priority-${String(i.priority).toLowerCase()}">${esc(i.priority)}</span></small><small class="task-due ${!i.done&&i.dueDate&&i.dueDate<=isoToday()?"task-overdue":""}">${i.dueDate?`Due ${nice(i.dueDate)}`:"No due date"}${i.detail?` · ${esc(i.detail)}`:""}</small></span><button class="tiny-btn" type="button" data-action="edit-task-v2" data-id="${i.id}">Edit</button><button class="tiny-btn danger" type="button" data-action="delete-v2" data-collection="preTrip" data-id="${i.id}">✕</button></label>`).join(""):empty("✅","Nothing here yet","Add a starter checklist or create your own task.","task")}</div>`;
}

/* Build 4 owns startup below. */


/* =====================================================================
   ICHIGO BUILD 4 — PERSONAL TRAVEL TOOLS
   Local-only / personal use. No Supabase, accounts, or cloud sync.

   Adds:
   1. Trip templates + custom templates
   2. Reusable day templates
   3. Trip Health Check
   4. Smart itinerary warnings
   5. Today Mode delay / skip / quick-note tools
   6. Expense analytics + budget forecast
   7. Offline Document Vault with attachments
   8. Per-trip export / import
   9. Personal travel stats
  10. Manual trip archive
   ===================================================================== */

const APP_VERSION_V4 = "4.0.0";
const APP_SCHEMA_VERSION_V4 = 4;
const CACHE_VERSION_V4 = "ichigo-build4-personal-v1";

function ensureStateV4() {
  ensureStateV3();
  state.customTripTemplates ||= [];
  state.dayTemplates ||= [];
  state.shelfFilter ||= "all";
  state.schemaVersion = Number(state.schemaVersion || 1);
  return state;
}

function ensureTripV4(t) {
  t = ensureTripV3(t);
  if (!t) return t;

  t.archived ??= false;
  t.archivedAt ||= "";
  t.quickNotes ||= [];

  (t.itinerary ||= []).forEach(item => {
    item.skipped ??= false;
    item.skippedAt ||= "";
    item.originalTime ||= "";
    item.delayMinutes = Number(item.delayMinutes || 0);
  });

  (t.expenses ||= []).forEach(item => {
    item.activityId ||= "";
  });

  (t.memories ||= []).forEach(item => {
    item.highlight ??= false;
  });

  t.essentials ||= {};
  t.essentials.documents ||= [];
  t.essentials.documents.forEach(doc => {
    doc.id ||= uuid();
    doc.category ||= "Other";
    doc.expiryDate ||= "";
    doc.important ??= false;
    doc.fileKey ||= "";
    doc.fileName ||= "";
    doc.createdAt ||= Date.now();
  });

  return t;
}

function migrateAllTripsV4(persist=false) {
  ensureStateV4();
  const before = Number(state.schemaVersion || 1);
  state.trips = (state.trips || []).map(ensureTripV4);

  if (before < 4 && !state.migrations?.some(x => x.version === 4)) {
    state.migrations ||= [];
    state.migrations.push({
      version: 4,
      at: Date.now(),
      note: "Personal Build 4 templates, health check, analytics and document vault"
    });
  }

  state.schemaVersion = APP_SCHEMA_VERSION_V4;
  state.appVersion = APP_VERSION_V4;
  if (persist) save();
}

function save() {
  state.schemaVersion = APP_SCHEMA_VERSION_V4;
  state.appVersion = APP_VERSION_V4;
  state.updatedAt = Date.now();
  localStorage.setItem(STORE, JSON.stringify(state));
}

function trip() {
  ensureStateV4();
  return ensureTripV4(state.trips.find(x => x.id === state.currentTripId) || state.trips[0]);
}

/* ---------- Small helpers ---------- */
function parseClockRangeV4(value="") {
  const cleaned = String(value).replace(/[–—]/g, "-");
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  return {start,end};
}

function linkedPlaceV4(activity,t=trip()) {
  const hay = `${activity.title || ""} ${activity.place || ""}`.toLowerCase();
  return t.places.find(p => {
    const name = String(p.name || "").toLowerCase();
    return name && (hay.includes(name) || name.includes(String(activity.title || "").toLowerCase()));
  }) || null;
}

function scheduleWarningsV4(date,t=trip()) {
  const rows = activitiesOn(date,t).filter(x => !x.skipped);
  const warnings = [];
  const fixed = rows.filter(x => !x.flexible && x.time).sort((a,b)=>minutesFromTime(a.time)-minutesFromTime(b.time));

  for (let i=1;i<fixed.length;i++) {
    const prev=fixed[i-1], cur=fixed[i];
    const prevEnd=minutesFromTime(prev.time)+Number(prev.duration||60);
    const needed=prevEnd+Number(cur.travelTime||0);
    const curStart=minutesFromTime(cur.time);
    if (curStart < needed) {
      const shortBy = needed-curStart;
      warnings.push({
        severity:"high",
        icon:"⏰",
        title:`${cur.title} may be too tight`,
        detail:`You need about ${shortBy} more minute${shortBy===1?"":"s"} after ${prev.title}, including travel time.`
      });
    } else if (curStart-needed < 15) {
      warnings.push({
        severity:"medium",
        icon:"🚃",
        title:`Very little buffer before ${cur.title}`,
        detail:`Only ${curStart-needed} minute${curStart-needed===1?"":"s"} of spare time after travel.`
      });
    }
  }

  if (rows.length >= 9) warnings.push({
    severity:"medium",icon:"🗓️",title:"This is a very full day",
    detail:`You have ${rows.length} activities planned. Consider moving a few to another day.`
  });

  fixed.forEach(item=>{
    const place=linkedPlaceV4(item,t);
    const hours=parseClockRangeV4(place?.openingHours||"");
    const start=minutesFromTime(item.time);
    if (hours && (start < hours.start || start > hours.end)) {
      warnings.push({
        severity:"high",icon:"🕐",title:`Check opening hours for ${place.name}`,
        detail:`You planned ${formatTimeV3(item.time)}, while the saved hours are ${place.openingHours}.`
      });
    }
  });

  return warnings;
}

function expenseAnalyticsV4(t=trip()) {
  const total=spent(t);
  const days=daysBetween(t.startDate,t.endDate);
  const byDate={};
  const byPayment={};

  t.expenses.forEach(e=>{
    byDate[e.date]=(byDate[e.date]||0)+Number(e.amount||0);
    const payment=e.payment||"Other";
    byPayment[payment]=(byPayment[payment]||0)+Number(e.amount||0);
  });

  const recordedDates=Object.keys(byDate);
  const averageRecordedDay=recordedDates.length?total/recordedDates.length:0;
  const projected=recordedDates.length?averageRecordedDay*days:0;
  const biggest=[...t.expenses].sort((a,b)=>Number(b.amount)-Number(a.amount))[0]||null;
  const expensiveDay=Object.entries(byDate).sort((a,b)=>b[1]-a[1])[0]||null;
  const remaining=Math.max(0,Number(t.totalBudget||0)-total);
  const remainingDays=Math.max(1,remainingTripDays(t)||days);

  return {
    total,days,byDate,byPayment,recordedDates,averageRecordedDay,projected,biggest,expensiveDay,
    remaining,remainingPerDay:remaining/remainingDays,
    forecastOver:Number(t.totalBudget||0)>0 && projected>Number(t.totalBudget||0)
  };
}

function healthCheckV4(t=trip()) {
  const items=[];
  const add=(severity,icon,title,detail,view,sub)=>items.push({severity,icon,title,detail,view,sub});

  const emptyDays=allDates(t).filter(d=>!activitiesOn(d,t).length);
  if (emptyDays.length) add("low","🗓️",`${emptyDays.length} itinerary day${emptyDays.length===1?" is":"s are"} empty`,"That can be intentional, but Ichigo is flagging it so you can review.", "plan","itinerary");

  const scheduleWarnings=allDates(t).flatMap(d=>scheduleWarningsV4(d,t).map(x=>({...x,date:d})));
  if (scheduleWarnings.length) add(
    scheduleWarnings.some(x=>x.severity==="high")?"high":"medium",
    "⏰",`${scheduleWarnings.length} schedule warning${scheduleWarnings.length===1?"":"s"}`,
    "Check overlaps, travel buffers and saved opening hours.","plan","itinerary"
  );

  const mustGo=t.places.filter(p=>p.priority==="Must go"&&!p.visited);
  const unplannedMustGo=mustGo.filter(p=>!t.itinerary.some(a=>`${a.title} ${a.place}`.toLowerCase().includes(String(p.name).toLowerCase())));
  if(unplannedMustGo.length)add("medium","❤️",`${unplannedMustGo.length} must-go place${unplannedMustGo.length===1?" isn't":"s aren't"} in the itinerary`,unplannedMustGo.slice(0,3).map(x=>x.name).join(" · "),"plan","places");

  const pendingBookings=t.bookings.filter(b=>!["Confirmed","Cancelled"].includes(b.status));
  if(pendingBookings.length)add("medium","🎟️",`${pendingBookings.length} booking${pendingBookings.length===1?" needs":"s need"} attention`,"Saved or pending bookings may still need confirmation.","plan","bookings");

  const packLeft=t.packing.filter(x=>!x.done).length;
  if(packLeft)add(status(t)==="active"?"high":"low","🧳",`${packLeft} packing item${packLeft===1?"":"s"} left`,"Finish packing before you leave.","plan","packing");

  const overdue=dueTasks(t);
  if(overdue.length)add("high","✅",`${overdue.length} pre-trip task${overdue.length===1?" is":"s are"} due or overdue`,overdue.slice(0,3).map(x=>x.name).join(" · "),"plan","before");

  const analytics=expenseAnalyticsV4(t);
  if(t.totalBudget>0&&analytics.total>t.totalBudget)add("high","💸","Trip budget exceeded",`You're ${money(analytics.total-t.totalBudget)} over the current budget.`,"spend","budget");
  else if(analytics.forecastOver)add("medium","📈","Current spending pace may exceed the budget",`Recorded-day average projects roughly ${money(analytics.projected)} for the trip.`,"spend","analytics");

  if(!t.essentials?.contacts?.length)add("medium","☎️","No emergency contact saved","Add at least one contact that remains available offline.","plan","essentials");
  if(!t.essentials?.hotelAddress && t.bookings.some(b=>b.type==="Hotel"))add("low","🏨","Hotel address isn't in Offline Essentials","Saving it there makes arrival day easier without data.","plan","essentials");

  const expiring=t.essentials?.documents?.filter(d=>d.expiryDate&&d.expiryDate<=t.endDate)||[];
  if(expiring.length)add("high","📄",`${expiring.length} document${expiring.length===1?"":"s"} expire by the end of this trip`,expiring.slice(0,3).map(x=>x.name).join(" · "),"plan","essentials");

  const weights={high:15,medium:8,low:4};
  const score=Math.max(0,100-items.reduce((s,x)=>s+(weights[x.severity]||5),0));
  return {score,items,scheduleWarnings};
}

function tripStageLabelV4(t) {
  if(t.archived)return"Archived";
  return tripStageLabel(t);
}

/* ---------- Personal Home / Travel Shelf ---------- */
function renderHome() {
  const t=trip(), st=status(t), s=spent(t), pack=t.packing.filter(x=>x.done).length, health=healthCheckV4(t);
  const packPct=t.packing.length?Math.round(pack/t.packing.length*100):0;
  const upcoming=[...t.itinerary].filter(x=>!x.skipped).sort(activitySort).find(x=>`${x.date} ${x.time||"23:59"}`>=`${isoToday()} 00:00`)||[...t.itinerary].filter(x=>!x.skipped).sort(activitySort)[0];
  const due=dueTasks(t);
  const countdown=st==="planning"?`${Math.max(0,daysUntil(t.startDate))} days to go! 🌸`:st==="active"?`DAY ${dayNo(isoToday(),t)} · ${t.cityLabel} 🍓`:`${daysBetween(t.startDate,t.endDate)} days · saved forever 📖`;

  const shelfTrips=state.trips.map(ensureTripV4).filter(x=>{
    if(state.shelfFilter==="all")return !x.archived;
    if(state.shelfFilter==="archived")return x.archived;
    if(x.archived)return false;
    return tripStageLabel(x).toLowerCase()===state.shelfFilter;
  });

  const allStats=personalTravelStatsV4();

  main.innerHTML=`
    <section class="hero-card ${t.coverKey?"has-cover":""}">
      ${t.coverKey?`<div class="hero-cover-photo" data-file-key="${t.coverKey}"></div>`:""}
      <div class="hero-content"><h1>${esc(t.title)} ${esc(t.countryEmoji)}</h1><p class="hero-countdown">${countdown}</p><p class="hero-dates">${nice(t.startDate)} – ${nice(t.endDate,{month:"short",day:"numeric",year:"numeric"})}</p></div>
      <div class="hero-progress" style="--progress:${pct(t)}%"><span>${pct(t)}%</span></div>
      <div class="hero-stats">
        <div class="hero-stat"><strong>🗓 ${t.itinerary.length}</strong><small>Plans</small></div>
        <div class="hero-stat"><strong>📍 ${t.places.length}</strong><small>Places</small></div>
        <div class="hero-stat"><strong>🎟 ${t.bookings.length}</strong><small>Bookings</small></div>
        <div class="hero-stat"><strong>💰 ${money(t.totalBudget)}</strong><small>Budget</small></div>
      </div>
    </section>

    <section class="section">
      <button class="health-summary-v4 ${health.score<70?"needs-attention":""}" data-action="open-health-v4">
        <div class="health-ring-v4" style="--health:${health.score}%"><strong>${health.score}</strong></div>
        <div><span class="eyebrow">TRIP HEALTH</span><h3>${health.items.length?`${health.items.length} thing${health.items.length===1?"":"s"} to review`:"You're looking ready ✨"}</h3><p>${health.items[0]?esc(health.items[0].title):"No major planning issues detected."}</p></div>
        <span>›</span>
      </button>
    </section>

    ${due.length?`<section class="section"><button class="notice-card danger" style="width:100%;text-align:left" data-action="open-feature" data-feature="before"><span class="notice-icon">⏰</span><span><strong>${due.length} pre-trip task${due.length===1?" is":"s are"} due</strong><p>${esc(due.slice(0,2).map(x=>x.name).join(" · "))}</p></span></button></section>`:""}

    <section class="section"><div class="grid-2">
      <button class="card mini-card" data-action="open-feature" data-feature="itinerary"><h3>Next Up</h3>${upcoming?`<div class="big-number" style="font-size:16px">${nice(upcoming.date,{weekday:"short",month:"short",day:"numeric"})}</div><div class="meta">${esc(upcoming.flexible?"Anytime":formatTimeV3(upcoming.time))} · ${esc(upcoming.title)}</div>`:`<div class="meta">No plans yet</div>`}</button>
      <button class="card mini-card" data-action="open-feature" data-feature="budget"><h3>Budget</h3><div class="big-number">${money(Math.max(0,t.totalBudget-s))}</div><div class="meta">${remainingTripDays(t)?`${money(Math.max(0,t.totalBudget-s)/remainingTripDays(t))} / day left`:"Trip complete"}</div><div class="progress"><span style="width:${Math.min(100,t.totalBudget?s/t.totalBudget*100:0)}%"></span></div></button>
      <button class="card mini-card" data-action="open-feature" data-feature="bookings"><h3>Bookings</h3><div class="big-number">${t.bookings.length}</div><div class="meta">${t.bookings.filter(x=>x.status==="Confirmed").length} confirmed</div></button>
      <button class="card mini-card" data-action="open-feature" data-feature="packing"><h3>Packing</h3><div class="big-number">${packPct}%</div><div class="meta">${pack}/${t.packing.length} items</div><div class="progress"><span style="width:${packPct}%"></span></div></button>
    </div></section>

    <section class="section">
      <div class="section-title"><h3>Your travel shelf</h3><div><button data-action="new-trip">＋ New</button><button data-action="trip-templates-v4">Templates</button></div></div>
      <div class="chips shelf-filters">${[["all","All"],["upcoming","Upcoming"],["ongoing","Ongoing"],["completed","Completed"],["archived","Archived"]].map(([k,l])=>`<button class="chip ${state.shelfFilter===k?"active":""}" data-action="shelf-filter-v2" data-filter="${k}">${l}</button>`).join("")}</div>
      <div class="travel-shelf">${shelfTrips.length?shelfTrips.map(x=>`
        <button class="card shelf-card-v2" data-action="switch-trip" data-id="${x.id}">
          <div class="shelf-cover">${x.coverKey?`<div class="shelf-cover-photo" data-file-key="${x.coverKey}"></div>`:""}<span class="shelf-flag">${esc(x.countryEmoji||"✈️")}</span><span class="shelf-status">${tripStageLabelV4(x)}</span></div>
          <div class="shelf-body"><h3>${esc(x.title)}</h3><p>${nice(x.startDate)} – ${nice(x.endDate,{month:"short",day:"numeric",year:"numeric"})} · ${x.places.filter(p=>p.visited).length}/${x.places.length} places · ${x.memories.length} memories</p></div>
        </button>`).join(""):empty("📚","No trips here yet","Create a trip or use one of your templates.")}</div>
    </section>

    <section class="card travel-stats-mini-v4">
      <div><span>✈️</span><strong>${allStats.trips}</strong><small>Trips</small></div>
      <div><span>🌏</span><strong>${allStats.destinations}</strong><small>Destinations</small></div>
      <div><span>🗓️</span><strong>${allStats.days}</strong><small>Travel days</small></div>
      <div><span>📍</span><strong>${allStats.visitedPlaces}</strong><small>Places visited</small></div>
    </section>`;
}

/* ---------- Trip + Day Templates ---------- */
function allTripTemplatesV4() {
  const built=(window.ICHIGO_DATA?.tripTemplates||[]).map(x=>({...clone(x),source:"built-in"}));
  const custom=(state.customTripTemplates||[]).map(x=>({...clone(x),source:"custom"}));
  return [...built,...custom];
}

function tripTemplatesHTMLV4() {
  const templates=allTripTemplatesV4();
  return `<div class="template-grid-v4">
    <button class="template-card-v4 blank" data-action="choose-trip-template-v4" data-template-id="blank"><span>＋</span><strong>Start blank</strong><small>Just dates, destination and currency</small></button>
    ${templates.map(t=>`<div class="template-wrap-v4"><button class="template-card-v4" data-action="choose-trip-template-v4" data-template-id="${esc(t.id)}"><span>${esc(t.emoji||"🍓")}</span><strong>${esc(t.label)}</strong><small>${esc(t.description||"Reusable trip starter")}</small></button>${t.source==="custom"?`<button class="template-delete-v4" data-action="delete-trip-template-v4" data-template-id="${t.id}" aria-label="Delete template">✕</button>`:""}</div>`).join("")}
  </div>`;
}

function newTrip() {
  openModal("Create a Trip",tripTemplatesHTMLV4());
}

function tripTemplateFormV4(templateId="blank") {
  const template=allTripTemplatesV4().find(x=>x.id===templateId)||{};
  const defaults=template.defaults||{};
  const start=dateOffset(isoToday(),30);
  const end=dateOffset(start,Math.max(0,Number(template.days||3)-1));
  return `<form id="tripTemplateCreateFormV4" data-template-id="${esc(templateId)}" class="form-grid">
    ${templateId!=="blank"?`<div class="notice-card"><span class="notice-icon">${esc(template.emoji||"🍓")}</span><span><strong>${esc(template.label||"Template")}</strong><p>${esc(template.description||"")}</p></span></div>`:""}
    <div class="form-row"><label>TRIP NAME</label><input name="title" required value="${esc(defaults.title||"")}" placeholder="Trip name"></div>
    <div class="form-row"><label>DESTINATION</label><input name="destination" required value="${esc(defaults.destination||"")}" placeholder="Destination"></div>
    <div class="form-row two"><div><label>START</label><input name="startDate" type="date" value="${start}" required></div><div><label>END</label><input name="endDate" type="date" value="${end}" required></div></div>
    <div class="form-row two"><div><label>FLAG / EMOJI</label><input name="countryEmoji" value="${esc(defaults.countryEmoji||template.emoji||"✈️")}"></div><div><label>CURRENCY</label><select name="baseCurrency">${currencyOptions(defaults.baseCurrency||state.settings.defaultTripCurrency)}</select></div></div>
    <button class="btn primary">Create trip</button>
  </form>`;
}

function createTripFromTemplateV4(templateId,data) {
  const template=allTripTemplatesV4().find(x=>x.id===templateId)||{};
  const t=ensureTripV4({
    id:uuid(),title:data.title.trim(),destination:data.destination.trim(),cityLabel:data.destination.toUpperCase(),
    countryEmoji:data.countryEmoji||template.emoji||"✈️",startDate:data.startDate,endDate:data.endDate,
    baseCurrency:data.baseCurrency,homeCurrency:state.settings.homeCurrency,totalBudget:Number(template.totalBudget||0),
    dailyBudget:Number(template.dailyBudget||0),categoryBudgets:clone(template.categoryBudgets||{}),coverKey:"",
    theme:"inherit",accentColor:"",archived:false,
    travelers:[],
    itinerary:[],places:[],bookings:[],packing:[],preTrip:[],expenses:[],memories:[],inbox:[]
  });

  const packing=template.packing || (template.packingTemplate?window.ICHIGO_DATA?.packingTemplates?.[template.packingTemplate]:null) || [];
  packing.forEach(row=>{
    if(Array.isArray(row))t.packing.push({id:uuid(),category:row[0],name:row[1],quantity:Number(row[2]||1),done:false});
    else t.packing.push({id:uuid(),...clone(row),done:false});
  });

  (template.preTrip||[]).forEach((x,index)=>t.preTrip.push({
    id:uuid(),...clone(x),done:false,
    dueDate:x.dueDate||dateOffset(t.startDate,-Math.max(2,21-index*2))
  }));

  if(template.useDefaultPreTrip && !t.preTrip.length){
    (window.ICHIGO_DATA?.preTripTemplate||[]).forEach((x,index)=>t.preTrip.push({
      id:uuid(),...clone(x),done:false,dueDate:dateOffset(t.startDate,-Math.max(2,30-index*3))
    }));
  }

  (template.starterDay||[]).forEach((x,index)=>t.itinerary.push({
    id:uuid(),date:t.startDate,time:x.time||"",title:x.title||"Activity",place:x.place||"",
    type:x.type||"place",notes:x.notes||"",duration:Number(x.duration||60),
    travelTime:Number(x.travelTime||0),flexible:!!x.flexible,order:index,completed:false,skipped:false
  }));

  state.trips.push(t);
  state.currentTripId=t.id;
  state.currentView="home";
  return t;
}

function saveTripTemplateModalV4() {
  openModal("Save Trip as Template",`<form id="saveTripTemplateFormV4" class="form-grid">
    <div class="form-row"><label>TEMPLATE NAME</label><input name="label" required value="${esc(trip().title)} template"></div>
    <div class="form-row"><label>DESCRIPTION</label><input name="description" value="Based on ${esc(trip().title)}"></div>
    <p class="meta">Ichigo saves your packing list, Before You Go checklist, category budgets and the structure of the first planned day. Personal expenses, bookings, photos and document files are not copied.</p>
    <button class="btn primary">Save reusable template</button>
  </form>`);
}

function dayTemplateSaveModalV4(date) {
  openModal("Save Day Template",`<form id="saveDayTemplateFormV4" data-date="${date}" class="form-grid"><div class="form-row"><label>TEMPLATE NAME</label><input name="name" required value="Day ${dayNo(date)} template"></div><p class="meta">Times, activity types, durations and notes are saved. Completion status is not.</p><button class="btn primary">Save day template</button></form>`);
}

function dayTemplateApplyModalV4(date) {
  const arr=state.dayTemplates||[];
  openModal("Use Day Template",arr.length?`<div class="template-grid-v4">${arr.map(x=>`<div class="template-wrap-v4"><button class="template-card-v4" data-action="apply-day-template-v4" data-template-id="${x.id}" data-date="${date}"><span>🗓️</span><strong>${esc(x.name)}</strong><small>${x.activities.length} activities</small></button><button class="template-delete-v4" data-action="delete-day-template-v4" data-template-id="${x.id}">✕</button></div>`).join("")}</div>`:empty("🗓️","No day templates yet","Save a planned day first, then reuse its structure on another trip or date."));
}

/* ---------- Smart Itinerary ---------- */
function itineraryHTML(date) {
  const t=trip();
  if(!allDates(t).includes(date))date=activeDate(t);
  state.activeItineraryDate=date;

  const items=activitiesOn(date,t);
  const totalDuration=items.filter(x=>!x.skipped).reduce((s,x)=>s+Number(x.duration||0),0);
  const travel=items.filter(x=>!x.skipped).reduce((s,x)=>s+Number(x.travelTime||0),0);
  const collapsed=!!state.collapsedDays[`${t.id}:${date}`];
  const warnings=scheduleWarningsV4(date,t);

  return `<div class="section-title"><h3>🗓️ Itinerary</h3><div class="section-actions-v3"><button data-action="save-day-template-v4" data-date="${date}">Save day</button><button data-action="use-day-template-v4" data-date="${date}">Use template</button><button data-action="duplicate-day-v3" data-date="${date}">Duplicate</button><button data-action="quick-add-type" data-type="activity">＋ Activity</button></div></div>
  <div class="chips">${allDates(t).map(d=>`<button class="chip ${d===date?"active":""}" data-action="show-itinerary-date-v3" data-date="${d}">Day ${dayNo(d,t)} · ${nice(d,{month:"short",day:"numeric"})}</button>`).join("")}</div>
  ${warnings.length?`<div class="schedule-warnings-v4">${warnings.map(w=>`<div class="notice-card ${w.severity==="high"?"danger":""}"><span class="notice-icon">${w.icon}</span><span><strong>${esc(w.title)}</strong><p>${esc(w.detail)}</p></span></div>`).join("")}</div>`:""}
  <div id="itineraryDay"><div class="day-summary day-summary-v3" data-action="toggle-day-collapse-v3" data-date="${date}" role="button" tabindex="0" aria-expanded="${!collapsed}"><div><strong>${items.length}</strong><small>activities</small></div><div><strong>${formatDuration(totalDuration)||"—"}</strong><small>planned</small></div><div><strong>${formatDuration(travel)||"—"}</strong><small>travel time</small></div><span>${collapsed?"Show":"Hide"} day</span></div>
  ${collapsed?`<div class="collapsed-day-v3">Day collapsed · ${items.length} activities</div>`:items.length?`<div data-itinerary-date="${date}">${items.map(i=>`${i.travelTime&&!i.skipped?`<div class="travel-block-v3">🚃 ${formatDuration(i.travelTime)} travel before next stop</div>`:""}${activityCardV2(i)}`).join("")}</div>`:empty("🗓️","Nothing planned yet","Add an activity or use a saved day template.","activity")}</div>`;
}

function activityCardV2(i) {
  return `<article class="itinerary-card ${i.completed?"activity-complete-v3":""} ${i.skipped?"activity-skipped-v4":""}" data-activity-id="${i.id}" data-date="${i.date}">
    <button class="drag-handle" data-action="drag-activity-v2" data-id="${i.id}" aria-label="Drag ${esc(i.title)} to reorder">⋮⋮</button>
    <div class="activity-time">${i.flexible?"Anytime":esc(formatTimeV3(i.time||""))}${i.delayMinutes?`<small>+${i.delayMinutes}m</small>`:""}</div>
    <div class="activity-main"><h4>${i.completed?"✓ ":""}${i.skipped?"↷ ":""}${ICON[i.type]||"📍"} ${esc(i.title)}</h4><p>${esc(i.place||i.address||"")}${i.notes?` · ${esc(i.notes)}`:""}</p>
      <div class="activity-meta">${i.duration?`<span class="badge gray">⏱ ${formatDuration(i.duration)}</span>`:""}${i.flexible?`<span class="badge gold">Flexible</span>`:""}${i.completed?`<span class="badge green">Done</span>`:""}${i.skipped?`<span class="badge gray">Skipped</span>`:""}${i.delayMinutes?`<span class="badge">Delayed ${i.delayMinutes}m</span>`:""}</div>
      <div class="activity-actions"><button class="tiny-btn" data-action="move-activity-step-v3" data-id="${i.id}" data-step="-1">↑</button><button class="tiny-btn" data-action="move-activity-step-v3" data-id="${i.id}" data-step="1">↓</button><button class="tiny-btn" data-action="edit-activity-v2" data-id="${i.id}">Edit</button><button class="tiny-btn" data-action="duplicate-activity-v2" data-id="${i.id}">Duplicate</button><button class="tiny-btn" data-action="move-activity-v2" data-id="${i.id}">Move day</button>${(i.address||i.lat||i.place)?`<a class="tiny-btn" href="${esc(preferredMapUrlV3(i))}" target="_blank" rel="noopener">Map</a>`:""}<button class="tiny-btn danger" data-action="delete-v2" data-collection="itinerary" data-id="${i.id}">Delete</button></div>
    </div></article>`;
}

/* ---------- Today Mode 4 ---------- */
function timelineStateV3(date,t=trip()) {
  const items=activitiesOn(date,t), activeItems=items.filter(x=>!x.skipped), isToday=date===isoToday(), now=new Date(), nowMin=now.getHours()*60+now.getMinutes();
  let current=null,next=null;const overdue=[];
  if(!isToday){next=activeItems.find(x=>!x.completed)||activeItems[0]||null;return{items,current,next,overdue,isToday,nowMin}}
  for(const item of activeItems){
    if(item.completed)continue;
    const start=minutesFromTime(item.time),end=start==null?null:start+Number(item.duration||60);
    if(start!=null&&nowMin>=start&&nowMin<end&&!current)current=item;
    else if(start!=null&&nowMin>=end)overdue.push(item);
    else if(start!=null&&nowMin<start&&!next)next=item;
  }
  if(!current&&!next)next=activeItems.find(x=>!x.completed&&x.flexible)||null;
  return{items,current,next,overdue,isToday,nowMin};
}

function renderToday() {
  const t=trip(),date=activeDate(t),ts=timelineStateV3(date,t),daily=spentDate(date,t),bookings=t.bookings.filter(b=>b.date===date).sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99"));
  const focus=ts.current||ts.next;
  const warnings=scheduleWarningsV4(date,t);

  main.innerHTML=`<section class="today-header"><p class="eyebrow" style="color:#8b3044!important">${esc(t.cityLabel||t.destination)} · DAY ${dayNo(date,t)}</p><h1>${nice(date,{weekday:"long",month:"long",day:"numeric"})}</h1><p>${ts.isToday?"Your live travel day":"Previewing Today Mode"}</p></section>
    ${focus?`<section class="card today-focus"><div class="badge ${ts.current?"green":""}">${ts.current?"HAPPENING NOW":"NEXT"}</div><div class="countdown">${ts.current?`${Math.max(1,Math.ceil((minutesFromTime(focus.time)+Number(focus.duration||60)-ts.nowMin)))} min left`:ts.isToday?countdownLabelV3(focus,ts.nowMin):"Up next"}</div><h3>${ICON[focus.type]||"📍"} ${esc(focus.title)}</h3><p>${esc(focus.place||focus.address||"")} · ${focus.flexible?"Anytime":esc(formatTimeV3(focus.time))}</p>
      <div class="activity-actions today-primary-actions-v4"><button class="tiny-btn primary" data-action="arrived-v3" data-id="${focus.id}">📍 I'm here</button><button class="tiny-btn" data-action="complete-activity-v3" data-id="${focus.id}">✓ Done</button><button class="tiny-btn" data-action="delay-activity-v4" data-id="${focus.id}" data-minutes="15">+15m</button><button class="tiny-btn" data-action="delay-activity-v4" data-id="${focus.id}" data-minutes="30">+30m</button><button class="tiny-btn" data-action="skip-activity-v4" data-id="${focus.id}">Skip</button><a class="tiny-btn" href="${esc(preferredMapUrlV3(focus))}" target="_blank" rel="noopener">Map</a></div>
      <div class="activity-actions today-secondary-actions-v4"><button class="tiny-btn" data-action="activity-note-v4" data-id="${focus.id}">📝 Note</button><button class="tiny-btn" data-action="activity-expense-v4" data-id="${focus.id}">💸 Expense</button><button class="tiny-btn" data-action="activity-memory-v4" data-id="${focus.id}">📸 Memory</button>${focus.delayMinutes?`<button class="tiny-btn" data-action="reset-delay-v4" data-id="${focus.id}">Reset delay</button>`:""}</div>
    </section>`:empty("🌸","A free day","Nothing is scheduled for this day yet.","activity")}
    ${warnings.length?`<section class="notice-card ${warnings.some(x=>x.severity==="high")?"danger":""}" style="margin-top:10px"><span class="notice-icon">💡</span><span><strong>${warnings.length} schedule note${warnings.length===1?"":"s"} for today</strong><p>${esc(warnings[0].title)}</p></span></section>`:""}
    ${ts.overdue.length?`<section class="notice-card danger" style="margin-top:10px"><span class="notice-icon">⏰</span><span><strong>${ts.overdue.length} unfinished item${ts.overdue.length===1?"":"s"} passed their planned time.</strong><p>Delay, skip or mark them done without rebuilding the day.</p></span></section>`:""}
    <section class="card" style="padding:16px;margin-top:12px"><div class="section-title"><h3>Today’s timeline</h3><span class="meta">${ts.items.filter(x=>x.completed).length}/${ts.items.filter(x=>!x.skipped).length} done · ${ts.items.filter(x=>x.skipped).length} skipped</span></div><div class="today-timeline-v3">${ts.items.length?ts.items.map(i=>`<article class="today-line-v3 ${i.completed?"done":""} ${i.skipped?"skipped-v4":""} ${ts.current?.id===i.id?"current":""}"><span>${i.flexible?"Anytime":esc(formatTimeV3(i.time))}</span><div><strong>${i.skipped?"↷ ":""}${esc(i.title)}</strong><small>${esc(i.place||"")}${i.delayMinutes?` · +${i.delayMinutes}m`:""}</small></div><div class="today-row-tools-v4"><button class="tiny-btn" data-action="complete-activity-v3" data-id="${i.id}">${i.completed?"Undo":"Done"}</button><button class="tiny-btn" data-action="skip-activity-v4" data-id="${i.id}">${i.skipped?"Restore":"Skip"}</button></div></article>`).join(""):"<p class='meta'>No activities yet.</p>"}</div></section>
    <section class="card" style="padding:16px;margin-top:12px;background:linear-gradient(145deg,#fff,#fff0f3)"><div class="section-title"><h3>Today’s spending</h3><span>${money(daily)} / ${money(t.dailyBudget)}</span></div><div class="progress"><span style="width:${Math.min(100,t.dailyBudget?daily/t.dailyBudget*100:0)}%"></span></div></section>
    ${bookings.length?`<section class="section"><div class="section-title"><h3>🎟 Today’s bookings</h3><button data-action="open-bookings-v3">View all</button></div><div class="list">${bookingRows(bookings.slice(0,3))}</div></section>`:""}
    <section class="section"><div class="grid-3"><button class="btn soft" data-action="quick-add-type" data-type="expense">＋ Expense</button><button class="btn soft" data-action="open-feature" data-feature="converter">💱 Convert</button><button class="btn soft" data-action="today-essentials-v2">🆘 Essentials</button></div></section>`;
}

/* ---------- Expense Analytics ---------- */
function renderSpend() {
  const menu=[["budget","💰","Budget"],["expenses","🧾","Expenses"],["analytics","📈","Analytics"],["converter","💱","Converter"],["split","💸","Split"]];
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">SPEND</p><h1>Trip money</h1><p>${esc(trip().title)}</p></div><button class="btn soft" data-action="quick-add-type" data-type="expense">＋ Expense</button></div><div class="chips">${menu.map(([k,e,l])=>`<button class="chip ${state.spendView===k?"active":""}" data-action="set-spend-view" data-feature="${k}">${e} ${l}</button>`).join("")}</div><section class="section">${spendHTML(state.spendView)}</section>`;
}

function spendHTML(v) {
  return v==="expenses"?expensesHTML():v==="analytics"?expenseAnalyticsHTMLV4():v==="converter"?converterHTML():v==="split"?splitHTML():budgetHTML();
}

function expenseAnalyticsHTMLV4() {
  const t=trip(),a=expenseAnalyticsV4(t);
  const dates=allDates(t),maxDay=Math.max(1,...dates.map(d=>Number(a.byDate[d]||0)));
  const paymentMax=Math.max(1,...Object.values(a.byPayment));
  return `<div class="section-title"><h3>📈 Expense Analytics</h3><span class="meta">${t.expenses.length} entries</span></div>
    ${a.forecastOver?`<div class="notice-card danger"><span class="notice-icon">📈</span><span><strong>Budget forecast warning</strong><p>Based on recorded spending days, the trip projects to about ${money(a.projected)}, above your ${money(t.totalBudget)} budget.</p></span></div>`:""}
    <div class="analytics-grid-v4">
      <div class="card analytics-stat-v4"><small>Total spent</small><strong>${money(a.total)}</strong></div>
      <div class="card analytics-stat-v4"><small>Avg recorded day</small><strong>${money(a.averageRecordedDay)}</strong></div>
      <div class="card analytics-stat-v4"><small>Remaining / day</small><strong>${money(a.remainingPerDay)}</strong></div>
      <div class="card analytics-stat-v4"><small>Projected total</small><strong>${a.recordedDates.length?money(a.projected):"—"}</strong></div>
    </div>
    <div class="grid-2" style="margin-top:10px">
      <div class="card analytics-feature-v4"><span>💎 Biggest expense</span><strong>${a.biggest?money(a.biggest.amount):"—"}</strong><small>${a.biggest?esc(a.biggest.merchant||a.biggest.title):"No expenses yet"}</small></div>
      <div class="card analytics-feature-v4"><span>🔥 Most expensive day</span><strong>${a.expensiveDay?money(a.expensiveDay[1]):"—"}</strong><small>${a.expensiveDay?nice(a.expensiveDay[0]):"No spending days yet"}</small></div>
    </div>
    <div class="card analytics-panel-v4"><div class="section-title"><h3>Daily spending</h3></div>${dates.map(d=>`<div class="analytics-bar-row-v4"><span>Day ${dayNo(d,t)}</span><div><i style="width:${Number(a.byDate[d]||0)/maxDay*100}%"></i></div><small>${money(a.byDate[d]||0)}</small></div>`).join("")}</div>
    <div class="card analytics-panel-v4"><div class="section-title"><h3>Payment methods</h3></div>${Object.keys(a.byPayment).length?Object.entries(a.byPayment).sort((a,b)=>b[1]-a[1]).map(([name,val])=>`<div class="analytics-bar-row-v4"><span>${esc(name)}</span><div><i style="width:${val/paymentMax*100}%"></i></div><small>${money(val)}</small></div>`).join(""):`<p class="meta">No expense data yet.</p>`}</div>`;
}

/* ---------- Offline Document Vault ---------- */
function documentFormHTMLV3(item={}) {
  const cats=window.ICHIGO_DATA?.documentCategories||["Passport","Visa","Insurance","Transport","Hotel","Ticket","Medical","Other"];
  return `<form id="documentFormV4" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row"><label>DOCUMENT</label><input name="name" required value="${esc(item.name||"")}" placeholder="Travel insurance"></div>
    <div class="form-row two"><div><label>CATEGORY</label><select name="category">${cats.map(x=>`<option ${item.category===x?"selected":""}>${esc(x)}</option>`).join("")}</select></div><div><label>EXPIRY DATE</label><input name="expiryDate" type="date" value="${item.expiryDate||""}"></div></div>
    <label class="check-inline-v3"><input name="important" type="checkbox" ${item.important?"checked":""}> Pin as important</label>
    <div class="form-row"><label>REFERENCE / NOTE</label><textarea name="reference" placeholder="Booking reference, policy note, where the original is kept...">${esc(item.reference||"")}</textarea></div>
    <div class="form-row"><label>OFFLINE FILE / PHOTO</label><input name="attachment" type="file" accept="image/*,.pdf"><small class="inline-help">${item.fileKey?`Current file: ${esc(item.fileName||"attachment")} · leave blank to keep it.`:"Stored only on this device in IndexedDB."}</small></div>
    <button class="btn primary">Save to Document Vault</button>
  </form>`;
}

function essentialsHTMLV2() {
  const e=trip().essentials,docs=[...(e.documents||[])].sort((a,b)=>Number(b.important)-Number(a.important)||(a.expiryDate||"9999").localeCompare(b.expiryDate||"9999"));
  return `<div class="section-title"><h3>🆘 Offline Travel Essentials</h3><button data-action="edit-essentials-v2">Edit</button></div>
  <div class="notice-card success"><span class="notice-icon">✈️</span><span><strong>Designed for offline access</strong><p>Hotel, insurance, contacts, your document vault and saved phrases stay on this device.</p></span></div>
  <div class="essentials-grid" style="margin-top:10px"><div class="card essential-card"><h3>🏨 Stay</h3><div class="essential-value"><strong>${esc(e.hotelName||"No hotel saved")}</strong>${e.hotelAddress?`\n${esc(e.hotelAddress)}`:""}${e.hotelPhone?`\n☎ ${esc(e.hotelPhone)}`:""}</div></div><div class="card essential-card"><h3>🛡️ Insurance</h3><div class="essential-value"><strong>${esc(e.insuranceProvider||"No insurance saved")}</strong>${e.insurancePolicy?`\nPolicy: ${esc(e.insurancePolicy)}`:""}${e.insurancePhone?`\n☎ ${esc(e.insurancePhone)}`:""}</div></div><div class="card essential-card"><h3>🩺 Medical / safety notes</h3><div class="essential-value">${esc(e.medicalNotes||"No notes saved")}</div></div><div class="card essential-card"><h3>🚃 Transport notes</h3><div class="essential-value">${esc(e.transitNotes||"No notes saved")}</div></div></div>
  <section class="section"><div class="section-title"><h3>Emergency contacts</h3><button data-action="add-contact-v3">＋ Contact</button></div><div class="card" style="padding:8px 13px">${e.contacts.length?e.contacts.map(c=>`<div class="contact-row"><div class="row-icon">☎️</div><div class="row-main"><h4>${esc(c.name)}</h4><p>${esc(c.phone)} ${c.note?`· ${esc(c.note)}`:""}</p></div><button class="tiny-btn" data-action="edit-contact-v3" data-id="${c.id}">Edit</button><button class="tiny-btn danger" data-action="delete-essential-v2" data-kind="contacts" data-id="${c.id}">✕</button></div>`).join(""):`<div class="empty"><p>Add family, insurance or important contacts.</p></div>`}</div></section>
  <section class="section"><div class="section-title"><div><h3>🔐 Document Vault</h3><p class="meta">Local only · available offline</p></div><button data-action="add-document-v3">＋ Document</button></div><div class="document-vault-v4">${docs.length?docs.map(d=>`<article class="card document-card-v4 ${d.important?"important":""}">${d.fileKey?`<button class="document-file-v4" data-action="open-file-v2" data-file-key="${d.fileKey}" data-file-kind="${String(d.fileName||"").toLowerCase().endsWith(".pdf")?"file":"image"}">${String(d.fileName||"").toLowerCase().endsWith(".pdf")?"📄":"🖼️"}</button>`:`<div class="document-file-v4">📄</div>`}<div class="row-main"><div class="badge gray">${esc(d.category)}</div><h4>${d.important?"⭐ ":""}${esc(d.name)}</h4><p>${esc(d.reference||"No reference note")}</p>${d.expiryDate?`<small class="${d.expiryDate<=trip().endDate?"vault-expiry-warning-v4":""}">Expires ${nice(d.expiryDate)}</small>`:""}${d.fileName?`<small>Offline file: ${esc(d.fileName)}</small>`:""}</div><div class="document-actions-v4"><button class="tiny-btn" data-action="edit-document-v3" data-id="${d.id}">Edit</button><button class="tiny-btn danger" data-action="delete-document-v4" data-id="${d.id}">Delete</button></div></article>`).join(""):empty("🔐","Your vault is empty","Add tickets, insurance files, hotel PDFs or other travel references you want offline.")}</div><p class="inline-help">For privacy, store only documents you are comfortable keeping locally on this device. Ichigo does not upload them anywhere.</p></section>
  <section class="section"><div class="section-title"><h3>Useful phrases</h3><button data-action="add-phrase-v3">＋ Phrase</button></div><div class="list">${e.phrases.length?e.phrases.map(p=>`<div class="phrase-card"><button style="all:unset;cursor:pointer;display:block;width:100%" data-action="copy-text-v2" data-text="${esc(p.jp)}"><div class="jp">${esc(p.jp)}</div><div class="romaji">${esc(p.romaji||"")}</div><div class="translation">${esc(p.en||"")}</div></button><div class="activity-actions"><button class="tiny-btn" data-action="edit-phrase-v3" data-id="${p.id}">Edit</button><button class="tiny-btn danger" data-action="delete-essential-v2" data-kind="phrases" data-id="${p.id}">Delete</button></div></div>`).join(""):empty("💬","No phrases saved","Add useful phrases for offline access.")}</div></section>`;
}

/* ---------- Health + Stats ---------- */
function healthHTMLV4() {
  const h=healthCheckV4(), grouped={high:h.items.filter(x=>x.severity==="high"),medium:h.items.filter(x=>x.severity==="medium"),low:h.items.filter(x=>x.severity==="low")};
  return `<div class="health-hero-v4"><div class="health-ring-v4 large" style="--health:${h.score}%"><strong>${h.score}</strong><small>/100</small></div><div><p class="eyebrow">TRIP HEALTH</p><h2>${h.score>=90?"Looking sweet ✨":h.score>=70?"Almost ready 🌸":"A few things need attention"}</h2><p>${h.items.length?`${h.items.length} item${h.items.length===1?"":"s"} worth reviewing before or during the trip.`:"Ichigo didn't find any planning issues right now."}</p></div></div>
    ${["high","medium","low"].map(level=>grouped[level].length?`<section class="section"><div class="section-title"><h3>${level==="high"?"Needs attention":level==="medium"?"Worth checking":"Nice to review"}</h3><span class="badge ${level==="high"?"danger-badge-v4":"gray"}">${grouped[level].length}</span></div><div class="list">${grouped[level].map(x=>`<button class="health-item-v4 ${level}" data-action="health-jump-v4" data-view="${x.view}" data-sub="${x.sub}"><span>${x.icon}</span><div><strong>${esc(x.title)}</strong><p>${esc(x.detail)}</p></div><b>›</b></button>`).join("")}</div></section>`:"").join("")}`;
}

function personalTravelStatsV4() {
  const trips=(state.trips||[]).map(ensureTripV4).filter(x=>!x.archived);
  const destinations=new Set(trips.map(x=>String(x.destination||"").trim().toLowerCase()).filter(Boolean));
  return {
    trips:trips.length,
    destinations:destinations.size,
    days:trips.reduce((s,x)=>s+daysBetween(x.startDate,x.endDate),0),
    visitedPlaces:trips.reduce((s,x)=>s+x.places.filter(p=>p.visited).length,0),
    memories:trips.reduce((s,x)=>s+x.memories.length,0),
    totalExpenses:trips.reduce((s,x)=>s+spent(x),0)
  };
}

function statsHTMLV4() {
  const s=personalTravelStatsV4();
  const trips=[...(state.trips||[])].map(ensureTripV4).sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const years=[...new Set(trips.map(x=>parseDate(x.startDate)?.getFullYear()).filter(Boolean))].sort();
  return `<div class="stats-grid-v4">
    <div class="card"><span>✈️</span><strong>${s.trips}</strong><small>Trips</small></div>
    <div class="card"><span>🌏</span><strong>${s.destinations}</strong><small>Destinations</small></div>
    <div class="card"><span>🗓️</span><strong>${s.days}</strong><small>Travel days</small></div>
    <div class="card"><span>📍</span><strong>${s.visitedPlaces}</strong><small>Places visited</small></div>
    <div class="card"><span>📸</span><strong>${s.memories}</strong><small>Memories</small></div>
    <div class="card"><span>💴</span><strong>${s.totalExpenses?money(s.totalExpenses):"—"}</strong><small>Tracked spending*</small></div>
  </div>
  <p class="inline-help">*Spending is shown in the current trip currency and is only directly comparable when your trips use the same base currency.</p>
  <section class="section"><div class="section-title"><h3>Travel calendar</h3></div>${years.length?years.map(year=>`<div class="card calendar-year-v4"><h3>${year}</h3>${trips.filter(x=>parseDate(x.startDate)?.getFullYear()===year).map(x=>`<button data-action="switch-trip" data-id="${x.id}"><span>${esc(x.countryEmoji||"✈️")}</span><div><strong>${esc(x.title)}</strong><small>${nice(x.startDate,{month:"short",day:"numeric"})} – ${nice(x.endDate,{month:"short",day:"numeric"})}</small></div><b>${x.archived?"Archived":tripStageLabel(x)}</b></button>`).join("")}</div>`).join(""):empty("🗓️","No travel calendar yet","Your trips will appear here automatically.")}</section>`;
}

function renderTrip() {
  const menu=[["memories","📸","Journal"],["scrapbook","📖","Scrapbook"],["recap","📊","Trip Recap"],["health","💗","Health"],["stats","🌏","Stats"],["info","ℹ️","Trip Info"],["settings","⚙️","Settings"]];
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">TRIP</p><h1>${esc(trip().title)}</h1><p>Your trip story and personal tools</p></div></div><div class="chips">${menu.map(([k,e,l])=>`<button class="chip ${state.tripView===k?"active":""}" data-action="set-trip-view" data-feature="${k}">${e} ${l}</button>`).join("")}</div><section class="section">${tripHTML(state.tripView)}</section>`;
}

function tripHTML(v) {
  return v==="scrapbook"?scrapbookHTMLV2():v==="recap"?recapHTML():v==="health"?healthHTMLV4():v==="stats"?statsHTMLV4():v==="info"?infoHTML():v==="settings"?settingsHTML():memoriesHTML();
}

function infoHTML() {
  const t=trip();
  return `<div class="card" style="padding:16px"><div class="form-grid"><div class="form-row"><label>TRIP NAME</label><input id="infoTitleV3" value="${esc(t.title)}"></div><div class="form-row two"><div><label>DESTINATION</label><input id="infoDestinationV3" value="${esc(t.destination)}"></div><div><label>FLAG / EMOJI</label><input id="infoEmojiV3" value="${esc(t.countryEmoji||"✈️")}"></div></div><div class="form-row two"><div><label>START</label><input id="infoStartV3" type="date" value="${t.startDate}"></div><div><label>END</label><input id="infoEndV3" type="date" value="${t.endDate}"></div></div><div class="form-row two"><div><label>BASE CURRENCY</label><select id="infoCurrencyV3">${currencyOptions(t.baseCurrency)}</select></div><div><label>HOME CURRENCY</label><select id="infoHomeCurrencyV3">${currencyOptions(t.homeCurrency)}</select></div></div><div class="form-row two"><div><label>TRIP THEME</label><select id="infoThemeV3">${themeOptionsV3(t.theme)}</select></div><div><label>CUSTOM ACCENT</label><input id="infoAccentV3" type="color" value="${/^#[0-9a-f]{6}$/i.test(t.accentColor)?t.accentColor:"#ff6f91"}"></div></div><label class="check-inline-v3"><input id="useCustomAccentV3" type="checkbox" ${t.accentColor?"checked":""}> Use this custom accent for the trip</label><button class="btn primary" data-action="save-trip-info-v3">Save trip info</button></div></div>
  <div class="card" style="padding:16px;margin-top:10px"><div class="section-title"><h3>Trip cover</h3><span class="meta">used on your Travel Shelf</span></div>${t.coverKey?`<div class="shelf-cover" style="border-radius:17px;margin-bottom:9px"><div class="shelf-cover-photo" data-file-key="${t.coverKey}"></div></div>`:""}<input id="tripCoverInputV2" type="file" accept="image/*"><button class="btn soft full" style="margin-top:8px" data-action="save-cover-v2">Save cover photo</button></div>
  <div class="card" style="padding:16px;margin-top:10px"><div class="section-title"><h3>Reuse this trip</h3></div><div class="btn-row wrap-v3"><button class="btn soft" data-action="save-current-template-v4">Save as template</button><button class="btn" data-action="export-trip-v4">Export this trip</button><button class="btn" data-action="import-trip-v4">Import a trip</button></div><input id="importTripV4" type="file" accept="application/json" hidden><p class="inline-help">Trip export includes this trip's locally stored photos and attachments.</p></div>
  <div class="card" style="padding:16px;margin-top:10px"><div class="section-title"><h3>${t.archived?"Restore from archive":"Archive trip"}</h3></div><p class="meta">${t.archived?"Put this trip back on the main Travel Shelf.":"Hide this trip from the regular Travel Shelf without deleting it."}</p><button class="btn ${t.archived?"soft":"danger"} full" data-action="toggle-archive-v4">${t.archived?"Restore trip":"Archive trip"}</button></div>`;
}

function settingsHTML() {
  const s=state.settings,n=s.notifications||{};
  return `<div class="settings-stack-v3">
    <section class="card settings-card-v3"><div class="section-title"><h3>⚙️ App preferences</h3></div><form id="settingsFormV3" class="form-grid"><div class="form-row two"><div><label>YOUR NAME</label><input name="travelerName" value="${esc(s.travelerName)}"></div><div><label>HOME COUNTRY</label><input name="homeCountry" value="${esc(s.homeCountry)}"></div></div><div class="form-row two"><div><label>HOME CURRENCY</label><select name="homeCurrency">${currencyOptions(s.homeCurrency)}</select></div><div><label>DEFAULT TRIP CURRENCY</label><select name="defaultTripCurrency">${currencyOptions(s.defaultTripCurrency)}</select></div></div><div class="form-row two"><div><label>DATE FORMAT</label><select name="dateFormat">${(window.ICHIGO_DATA?.dateFormats||[]).map(x=>`<option value="${x.id}" ${s.dateFormat===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div><div><label>TIME FORMAT</label><select name="timeFormat">${(window.ICHIGO_DATA?.timeFormats||[]).map(x=>`<option value="${x.id}" ${s.timeFormat===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div></div><div class="form-row two"><div><label>PREFERRED MAP</label><select name="mapApp">${(window.ICHIGO_DATA?.mapApps||[]).map(x=>`<option value="${x.id}" ${s.mapApp===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div><div><label>APP THEME</label><select name="theme">${(window.ICHIGO_DATA?.themePresets||[]).map(x=>`<option value="${x.id}" ${s.theme===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div></div><button class="btn primary">Save preferences</button></form></section>
    <section class="card settings-card-v3"><div class="section-title"><h3>🍓 Personal templates</h3></div><p class="meta">${state.customTripTemplates.length} custom trip template${state.customTripTemplates.length===1?"":"s"} · ${state.dayTemplates.length} saved day template${state.dayTemplates.length===1?"":"s"}</p><div class="btn-row wrap-v3"><button class="btn soft" data-action="trip-templates-v4">Browse trip templates</button><button class="btn" data-action="save-current-template-v4">Save current trip</button></div></section>
    <section class="card settings-card-v3"><div class="section-title"><h3>🔔 Reminders</h3><span class="meta">while Ichigo is open</span></div><p class="meta">Web PWAs can show reminders while the app is running. Closed-app scheduling on iPhone still requires push/native infrastructure.</p><div class="form-row two"><div><label>ACTIVITY LEAD</label><select id="activityLeadV3">${(window.ICHIGO_DATA?.reminderLeadOptions||[]).map(x=>`<option value="${x}" ${Number(n.activityLead)===x?"selected":""}>${x} min</option>`).join("")}</select></div><div><label>BOOKING LEAD</label><select id="bookingLeadV3">${(window.ICHIGO_DATA?.reminderLeadOptions||[]).map(x=>`<option value="${x}" ${Number(n.bookingLead)===x?"selected":""}>${x} min</option>`).join("")}</select></div></div><div class="btn-row" style="margin-top:9px"><button class="btn soft" data-action="enable-notifications-v3">Enable reminders</button><button class="btn" data-action="save-reminder-settings-v3">Save reminder timing</button></div></section>
    <section class="card settings-card-v3"><div class="section-title"><h3>💾 Backup & restore</h3></div><p class="meta">Full backup includes all trips and local media. Per-trip export lives under Trip Info.</p><div class="btn-row"><button class="btn soft" data-action="export-full-backup-v3">Export full backup</button><button class="btn" data-action="import-full-backup-v3">Restore backup</button></div><input id="importFullBackupV3" type="file" accept="application/json" hidden><div class="storage-line-v3"><span>Local files</span><strong id="dbStatsV3">Checking…</strong></div><div class="storage-line-v3"><span>Browser storage</span><strong id="storageEstimateV3">Checking…</strong></div></section>
    <section class="card settings-card-v3"><div class="section-title"><h3>⬆️ App updates</h3></div><p class="meta">Ichigo checks GitHub Pages for a newer cached build.</p><div class="btn-row"><button class="btn soft" data-action="force-update-check-v3">Check for update</button><button class="btn" data-action="install-app">Install Ichigo</button></div></section>
    <section class="card settings-card-v3"><div class="section-title"><h3>🧪 Testing & debug</h3></div><div class="diagnostic-grid-v3"><span>App</span><strong>${APP_VERSION_V4}</strong><span>Schema</span><strong>v${APP_SCHEMA_VERSION_V4}</strong><span>Cache</span><strong>${CACHE_VERSION_V4}</strong><span>Network</span><strong>${navigator.onLine?"Online":"Offline"}</strong></div><div class="btn-row wrap-v3" style="margin-top:10px"><button class="btn soft" data-action="run-selftest-v3">Run self-test</button><button class="btn" data-action="copy-diagnostics-v3">Copy diagnostics</button><button class="btn" data-action="clear-caches-v3">Clear app caches</button></div></section>
    <section class="card settings-card-v3"><button class="btn danger full" data-action="reset-demo">Reset all local data</button></section>
  </div>`;
}

/* ---------- Per-trip export / import ---------- */
function collectTripFileKeysV4(value,keys=new Set()) {
  if(Array.isArray(value)){value.forEach(x=>collectTripFileKeysV4(x,keys));return keys}
  if(!value||typeof value!=="object")return keys;
  Object.entries(value).forEach(([k,v])=>{
    if(/Key$/.test(k)&&typeof v==="string"&&v)keys.add(v);
    else collectTripFileKeysV4(v,keys);
  });
  return keys;
}

async function exportTripV4() {
  try{
    notify("Preparing trip export…");
    const t=clone(trip()),keys=collectTripFileKeysV4(t),all=await IchigoDB.exportAll();
    const files=all.filter(x=>keys.has(x.id));
    download(`ichigo-trip-${String(t.title||"trip").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.json`,JSON.stringify({
      format:"ichigo-trip-export",version:1,appVersion:APP_VERSION_V4,exportedAt:new Date().toISOString(),trip:t,files
    }));
    notify(`Trip exported · ${files.length} local file${files.length===1?"":"s"}`);
  }catch(err){console.error(err);notify("Trip export couldn't be created.")}
}

async function importTripV4(file) {
  try{
    const payload=JSON.parse(await file.text());
    if(payload.format!=="ichigo-trip-export"||!payload.trip)throw Error("Invalid trip export");
    const imported=ensureTripV4(payload.trip);
    imported.id=uuid();
    imported.title=`${imported.title} (Imported)`;
    imported.archived=false;
    await IchigoDB.importAll(payload.files||[],{clearFirst:false});
    state.trips.push(imported);state.currentTripId=imported.id;state.currentView="home";save();render();notify("Trip imported ✓");
  }catch(err){console.error(err);alert("That file is not a valid Ichigo trip export.")}
}

/* Keep full backup metadata current. */
async function exportFullBackupV3(){
  try{
    notify("Preparing backup…");const files=await IchigoDB.exportAll();
    const payload={format:"ichigo-full-backup",backupVersion:2,appVersion:APP_VERSION_V4,schemaVersion:APP_SCHEMA_VERSION_V4,exportedAt:new Date().toISOString(),state,files};
    download(`ichigo-full-backup-${isoToday()}.json`,JSON.stringify(payload));notify(`Backup ready · ${files.length} local file${files.length===1?"":"s"}`);
  }catch(err){console.error(err);notify("Backup couldn't be created.")}
}

async function restoreFullBackupV3(file){
  try{
    const payload=JSON.parse(await file.text());
    if(payload.format!=="ichigo-full-backup"||!payload.state)throw Error("Invalid Ichigo backup");
    if(!confirm("Restore this backup? Current local Ichigo data and stored images will be replaced."))return;
    state=payload.state;ensureStateV4();state.trips=(state.trips||[]).map(ensureTripV4);
    await IchigoDB.importAll(payload.files||[],{clearFirst:true});save();render();notify("Ichigo backup restored ✓");
  }catch(err){console.error(err);alert("That file is not a valid Ichigo full backup.")}
}

async function diagnosticsV3(){
  const fileStats=await IchigoDB.stats().catch(()=>({count:-1,bytes:0})),cacheKeys=await caches.keys().catch(()=>[]);
  const reg=await Promise.resolve(navigator.serviceWorker?.getRegistration?.()).catch(()=>null);
  const storage=await Promise.resolve(navigator.storage?.estimate?.()).catch(()=>null);
  return {appVersion:APP_VERSION_V4,schemaVersion:state.schemaVersion,tripCount:state.trips.length,currentTrip:trip().title,online:navigator.onLine,serviceWorker:reg?{active:!!reg.active,waiting:!!reg.waiting}:"none",caches:cacheKeys,files:fileStats,storage,generatedAt:new Date().toISOString()};
}

/* ---------- Build 4 actions ---------- */
document.addEventListener("click",async event=>{
  const el=event.target.closest("[data-action]");if(!el)return;
  const a=el.dataset.action,t=trip();

  if(a==="open-health-v4"){state.currentView="trip";state.tripView="health";save();render()}
  if(a==="health-jump-v4"){state.currentView=el.dataset.view;if(state.currentView==="plan")state.planView=el.dataset.sub;if(state.currentView==="spend")state.spendView=el.dataset.sub;save();render()}

  if(a==="trip-templates-v4")openModal("Trip Templates",tripTemplatesHTMLV4())
  if(a==="choose-trip-template-v4")openModal("Trip Details",tripTemplateFormV4(el.dataset.templateId))
  if(a==="save-current-template-v4")saveTripTemplateModalV4()
  if(a==="delete-trip-template-v4"){if(confirm("Delete this custom trip template?")){state.customTripTemplates=state.customTripTemplates.filter(x=>x.id!==el.dataset.templateId);save();modalRoot.querySelector("#modalBody").innerHTML=tripTemplatesHTMLV4()}}

  if(a==="save-day-template-v4")dayTemplateSaveModalV4(el.dataset.date)
  if(a==="use-day-template-v4")dayTemplateApplyModalV4(el.dataset.date)
  if(a==="apply-day-template-v4"){
    const tpl=state.dayTemplates.find(x=>x.id===el.dataset.templateId),date=el.dataset.date;
    if(tpl){const start=activitiesOn(date,t).length;tpl.activities.forEach((x,i)=>t.itinerary.push({...clone(x),id:uuid(),date,order:start+i,completed:false,completedAt:"",skipped:false,skippedAt:"",arrivedAt:""}));renumberDay(date,t);state.activeItineraryDate=date;save();closeModal();render();notify("Day template added")}
  }
  if(a==="delete-day-template-v4"){if(confirm("Delete this day template?")){state.dayTemplates=state.dayTemplates.filter(x=>x.id!==el.dataset.templateId);save();dayTemplateApplyModalV4(el.dataset.date||activeDate())}}

  if(a==="delay-activity-v4"){
    const item=t.itinerary.find(x=>x.id===el.dataset.id),mins=Number(el.dataset.minutes||15);
    if(!item||!item.time||item.flexible){notify("This activity doesn't have a fixed time to delay.");return}
    item.originalTime ||= item.time;item.time=timeFromMinutes(minutesFromTime(item.time)+mins);item.delayMinutes=Number(item.delayMinutes||0)+mins;save();render();notify(`${item.title} moved ${mins} minutes later`)
  }
  if(a==="reset-delay-v4"){const item=t.itinerary.find(x=>x.id===el.dataset.id);if(item?.originalTime){item.time=item.originalTime;item.originalTime="";item.delayMinutes=0;save();render();notify("Original time restored")}}
  if(a==="skip-activity-v4"){const item=t.itinerary.find(x=>x.id===el.dataset.id);if(item){item.skipped=!item.skipped;item.skippedAt=item.skipped?new Date().toISOString():"";if(item.skipped)item.completed=false;save();render();notify(item.skipped?"Activity skipped":"Activity restored")}}
  if(a==="activity-note-v4"){const item=t.itinerary.find(x=>x.id===el.dataset.id);if(item)openModal("Quick Activity Note",`<form id="activityNoteFormV4" data-id="${item.id}" class="form-grid"><div class="form-row"><label>${esc(item.title)}</label><textarea name="note" placeholder="Anything you want to remember right now...">${esc(item.notes||"")}</textarea></div><button class="btn primary">Save note</button></form>`)}
  if(a==="activity-expense-v4"){const item=t.itinerary.find(x=>x.id===el.dataset.id);if(item)openModal("Expense for Activity",expenseFormHTMLV2({date:item.date,merchant:item.place||item.title,category:item.type==="transport"?"Transport":item.type==="shopping"?"Shopping":item.type==="food"||item.type==="cafe"?"Food":"Activities",notes:`From itinerary: ${item.title}`}))}
  if(a==="activity-memory-v4"){const item=t.itinerary.find(x=>x.id===el.dataset.id);if(item)openModal("Memory from Activity",memoryFormHTMLV2({date:item.date,time:item.time,title:item.title,location:item.place||item.address,lat:item.lat,lng:item.lng}))}

  if(a==="delete-document-v4"){
    const doc=t.essentials.documents.find(x=>x.id===el.dataset.id);
    if(doc&&confirm(`Delete ${doc.name}?`)){if(doc.fileKey)await IchigoDB.remove(doc.fileKey).catch(()=>{});t.essentials.documents=t.essentials.documents.filter(x=>x.id!==doc.id);save();render();notify("Document removed")}
  }

  if(a==="toggle-archive-v4"){
    t.archived=!t.archived;t.archivedAt=t.archived?new Date().toISOString():"";save();render();notify(t.archived?"Trip archived":"Trip restored")
  }

  if(a==="export-trip-v4")await exportTripV4()
  if(a==="import-trip-v4")document.querySelector("#importTripV4")?.click()
});

document.addEventListener("change",async event=>{
  const x=event.target;
  if(x.id==="importTripV4"&&x.files?.[0])await importTripV4(x.files[0]);
});

document.addEventListener("submit",async event=>{
  const f=event.target;if(!f.id?.endsWith("V4"))return;
  event.preventDefault();
  const d=Object.fromEntries(new FormData(f).entries()),t=trip();

  if(f.id==="tripTemplateCreateFormV4"){
    createTripFromTemplateV4(f.dataset.templateId,d);closeModal();save();render();notify("Trip created 🍓")
  }

  if(f.id==="saveTripTemplateFormV4"){
    const firstDay=allDates(t).find(date=>activitiesOn(date,t).length);
    const template={
      id:uuid(),label:d.label.trim(),description:d.description.trim(),emoji:t.countryEmoji||"🍓",source:"custom",
      totalBudget:t.totalBudget,dailyBudget:t.dailyBudget,categoryBudgets:clone(t.categoryBudgets||{}),
      packing:t.packing.map(x=>({category:x.category,name:x.name,quantity:x.quantity||1})),
      preTrip:t.preTrip.map(x=>({category:x.category,name:x.name,detail:x.detail,priority:x.priority})),
      starterDay:firstDay?activitiesOn(firstDay,t).map(x=>({time:x.time,title:x.title,place:"",type:x.type,notes:x.notes,duration:x.duration,travelTime:x.travelTime,flexible:x.flexible})):[]
    };
    state.customTripTemplates.push(template);save();closeModal();notify("Reusable trip template saved")
  }

  if(f.id==="saveDayTemplateFormV4"){
    const date=f.dataset.date,activities=activitiesOn(date,t).map(x=>({
      time:x.time,title:x.title,place:x.place,type:x.type,notes:x.notes,duration:x.duration,travelTime:x.travelTime,flexible:x.flexible,address:x.address||"",link:x.link||""
    }));
    state.dayTemplates.push({id:uuid(),name:d.name.trim(),createdAt:Date.now(),activities});save();closeModal();notify("Day template saved")
  }

  if(f.id==="activityNoteFormV4"){
    const item=t.itinerary.find(x=>x.id===f.dataset.id);if(item){item.notes=d.note.trim();save();closeModal();render();notify("Activity note saved")}
  }

  if(f.id==="documentFormV4"){
    const editId=f.dataset.editId||"",old=editId?t.essentials.documents.find(x=>x.id===editId):null,item=old||{id:uuid(),fileKey:"",fileName:"",createdAt:Date.now()};
    const input=f.querySelector('[name="attachment"]');
    if(input?.files?.[0]){
      try{
        let blob=input.files[0];
        if(blob.type?.startsWith("image/"))blob=await IchigoDB.compressImage(blob,1600,.8);
        if(item.fileKey)await IchigoDB.remove(item.fileKey).catch(()=>{});
        item.fileKey=await IchigoDB.put(blob,{name:input.files[0].name,kind:"document"});
        item.fileName=input.files[0].name;
      }catch(err){console.error(err);notify("The attachment could not be stored, but the document details can still be saved.")}
    }
    Object.assign(item,{name:d.name.trim(),category:d.category,expiryDate:d.expiryDate||"",important:!!d.important,reference:d.reference.trim()});
    if(!old)t.essentials.documents.push(item);save();closeModal();render();notify("Document Vault updated")
  }
});

/* Build 5–7 consolidated startup runs below. */



/* =====================================================================
   ICHIGO BUILDS 5 + 6 + 7 — PERSONAL SMART TRAVEL EDITION
   No Supabase. No login. No cloud database.

   BUILD 5 — Smart Personal Planning
   - Plan My Day
   - local route ordering + distance warnings
   - unscheduled / Must-Go tray
   - day intensity, day budgets, expected costs
   - flexible dayparts, push-later actions
   - scratchpad, Trip Notes, richer Inbox conversion
   - dashboard extras, favorites, undo, autosave, recent changes

   BUILD 6 — Memories & Scrapbook
   - daily travel timeline
   - food diary
   - highlights / favorites
   - visited story map
   - journal prompts + memory types
   - richer automatic scrapbook and trip recap

   BUILD 7 — Personal Release Readiness
   - stronger runtime/offline status
   - storage manager + orphan cleanup
   - storage safeguards
   - safe render recovery + error log
   - release self-test
   - migration to schema 7
   - improved PWA update/offline controls
   ===================================================================== */

const APP_VERSION_V7 = "7.0.0-personal";
const APP_SCHEMA_VERSION_V7 = 7;
const CACHE_VERSION_V7 = "ichigo-build7-app-v1";
const ERROR_LOG_V7 = "ichigo-error-log-v7";

const DEFAULT_DASHBOARD_WIDGETS_V7 = [
  "mustgo", "intensity", "daybudget", "scratchpad", "recent"
];

let undoStackV7 = [];
let saveStatusTimerV7 = null;
let storyMapV7 = null;
let storageWarningShownV7 = false;

/* ---------- State + migrations ---------- */
function ensureStateV7() {
  ensureStateV4();
  state.settings.dashboardWidgets ||= clone(DEFAULT_DASHBOARD_WIDGETS_V7);
  state.settings.offlinePreparedAt ||= "";
  state.settings.releaseMode ??= true;
  state.storyDate ||= "";
  state.memoryFilter ||= "all";
  state.planMyDay ||= { pace:"comfortable", startTime:"09:00" };
  state.onboarding ||= {};
  state.onboarding.build7Seen ??= false;
  return state;
}

function normalizeQuickNoteV7(note) {
  if (typeof note === "string") return {id:uuid(),text:note,pinned:false,createdAt:Date.now()};
  return {
    id: note?.id || uuid(),
    text: note?.text || note?.note || "",
    pinned: !!note?.pinned,
    createdAt: Number(note?.createdAt || Date.now())
  };
}

function ensureTripV7(t) {
  t = ensureTripV4(t);
  if (!t) return t;

  t.dayBudgets ||= {};
  t.tripNotes ||= "";
  t.quickNotes = (t.quickNotes || []).map(normalizeQuickNoteV7);
  t.recentChanges ||= [];
  t.recentChanges = t.recentChanges.slice(0, 30);

  (t.places ||= []).forEach(p => {
    p.estimatedDuration = Number(p.estimatedDuration || 90);
    p.estimatedCost = Number(p.estimatedCost || 0);
    p.favorite ??= false;
  });

  (t.itinerary ||= []).forEach(a => {
    a.daypart ||= a.flexible ? "Anytime" : "Fixed";
    a.estimatedCost = Number(a.estimatedCost || 0);
    a.sourcePlaceId ||= "";
    a.favorite ??= false;
  });

  (t.memories ||= []).forEach(m => {
    m.memoryType ||= "Moment";
    m.prompt ||= "";
    m.favorite ??= !!m.highlight;
    m.highlight = !!m.favorite;
  });

  return t;
}

function migrateAllTripsV7(persist=false) {
  ensureStateV7();
  const before = Number(state.schemaVersion || 1);
  state.trips = (state.trips || []).map(ensureTripV7);
  state.migrations ||= [];

  [
    [5,"Smart personal planning, day budgets, favorites and scratchpad"],
    [6,"Travel timeline, food diary, highlights and scrapbook"],
    [7,"Offline/storage safeguards, recovery and release readiness"]
  ].forEach(([version,note]) => {
    if (before < version && !state.migrations.some(x => x.version === version)) {
      state.migrations.push({version,at:Date.now(),note});
    }
  });

  state.schemaVersion = APP_SCHEMA_VERSION_V7;
  state.appVersion = APP_VERSION_V7;
  if (persist) save();
}

/* Override trip() and save() for the final personal schema. */
trip = function tripV7() {
  ensureStateV7();
  return ensureTripV7(state.trips.find(x => x.id === state.currentTripId) || state.trips[0]);
};

function ensureStatusUIV7() {
  if (document.querySelector("#appStatusHostV7")) return;
  const updateHost = document.querySelector("#appUpdateHost");
  if (!updateHost) return;
  const host = document.createElement("div");
  host.id = "appStatusHostV7";
  host.className = "app-status-v7";
  host.setAttribute("aria-live","polite");
  host.innerHTML = `<span id="saveStatusV7">Saved ✓</span><span class="status-sep-v7">·</span><button data-action="open-offline-v7" id="offlineStatusV7">${navigator.onLine?"Online":"Offline"}</button><span class="status-sep-v7">·</span><button data-action="undo-v7" id="undoStatusV7" hidden>Undo</button>`;
  updateHost.insertAdjacentElement("afterend",host);
}

function setSaveStatusV7(text,kind="") {
  ensureStatusUIV7();
  const el=document.querySelector("#saveStatusV7");
  if(!el)return;
  el.textContent=text;
  el.dataset.kind=kind;
}

save = function saveV7() {
  ensureStateV7();
  state.schemaVersion = APP_SCHEMA_VERSION_V7;
  state.appVersion = APP_VERSION_V7;
  state.updatedAt = Date.now();
  setSaveStatusV7("Saving…","saving");

  try {
    const raw = JSON.stringify(state);
    localStorage.setItem(STORE, raw);

    if (raw.length > 4_000_000 && !storageWarningShownV7) {
      storageWarningShownV7 = true;
      setTimeout(()=>notify("Ichigo's structured data is getting large. Consider exporting a backup and keeping photos in the Storage Manager."),300);
    }

    clearTimeout(saveStatusTimerV7);
    saveStatusTimerV7=setTimeout(()=>setSaveStatusV7("Saved ✓","saved"),240);
  } catch (error) {
    logErrorV7(error,"save");
    setSaveStatusV7("Save failed","error");
    setTimeout(()=>notify("Ichigo couldn't save this change. Export a backup before making more edits."),50);
  }
};

/* ---------- Error recovery ---------- */
function logErrorV7(error,where="runtime") {
  try {
    const rows=JSON.parse(sessionStorage.getItem(ERROR_LOG_V7)||"[]");
    rows.unshift({
      at:new Date().toISOString(),
      where,
      message:String(error?.message||error||"Unknown error"),
      stack:String(error?.stack||"").slice(0,1200)
    });
    sessionStorage.setItem(ERROR_LOG_V7,JSON.stringify(rows.slice(0,12)));
  } catch {}
}

window.addEventListener("error",e=>logErrorV7(e.error||e.message,"window.error"));
window.addEventListener("unhandledrejection",e=>logErrorV7(e.reason,"unhandledrejection"));

function recoveryHTMLV7(error) {
  return `<section class="recovery-v7">
    <div class="recovery-berry-v7">🍓</div>
    <p class="eyebrow">ICHIGO RECOVERY</p>
    <h1>Something in this screen got tangled.</h1>
    <p>Your local trip data has not been deliberately reset. You can go Home, export a full backup, or run the release check.</p>
    <div class="btn-row wrap-v3">
      <button class="btn primary" data-action="recovery-home-v7">Go Home</button>
      <button class="btn soft" data-action="export-full-backup-v3">Export backup</button>
      <button class="btn" data-action="open-release-v7">Release check</button>
    </div>
    <details><summary>Technical detail</summary><pre>${esc(String(error?.message||error||"Unknown render error"))}</pre></details>
  </section>`;
}

/* Final render wrapper. */
render = function renderV7() {
  try {
    ensureStateV7();
    state.trips = (state.trips || []).map(ensureTripV7);
    applyAppearanceV3();

    document.querySelectorAll(".nav-item").forEach(x=>{
      const active=x.dataset.nav===state.currentView;
      x.classList.toggle("active",active);
      if(active)x.setAttribute("aria-current","page");else x.removeAttribute("aria-current");
    });

    const fn=({home:renderHome,plan:renderPlan,today:renderToday,spend:renderSpend,together:renderTogether,trip:renderTrip}[state.currentView]||renderHome);
    fn();
    updateOnline();
    afterRenderV2();
    afterRenderV3();
    afterRenderV7();
  } catch (error) {
    console.error("Ichigo render recovery",error);
    logErrorV7(error,"render");
    main.innerHTML=recoveryHTMLV7(error);
    updateOnline();
    ensureStatusUIV7();
  }
};

function afterRenderV7() {
  ensureStatusUIV7();
  const offline=document.querySelector("#offlineStatusV7");
  if(offline)offline.textContent=navigator.onLine?"Online":"Offline";
  initStoryMapV7();
  if(document.querySelector("#storageManagerBodyV7"))renderStorageManagerV7();
  if(document.querySelector("#releaseCheckBodyV7"))runReleaseSelfTestV7(false);
  updateDashboardStorageV7();
}

/* ---------- Undo + recent changes ---------- */
function pushUndoV7(label) {
  const t=trip();
  undoStackV7.push({label,tripId:t.id,trip:clone(t),at:Date.now()});
  undoStackV7=undoStackV7.slice(-8);
  ensureStatusUIV7();
  const btn=document.querySelector("#undoStatusV7");
  if(btn){btn.hidden=false;btn.textContent=`Undo ${label}`;}
}

function undoV7() {
  const snap=undoStackV7.pop();
  if(!snap){notify("Nothing to undo.");return}
  const idx=state.trips.findIndex(x=>x.id===snap.tripId);
  if(idx<0){notify("That trip is no longer available.");return}
  state.trips[idx]=ensureTripV7(snap.trip);
  state.currentTripId=snap.tripId;
  save();render();notify(`Undid ${snap.label}`);
  const btn=document.querySelector("#undoStatusV7");
  if(btn){btn.hidden=!undoStackV7.length;btn.textContent=undoStackV7.length?`Undo ${undoStackV7.at(-1).label}`:"Undo";}
}

function markChangedV7(label,kind="",id="") {
  const t=trip();
  t.recentChanges ||= [];
  t.recentChanges.unshift({id:uuid(),label,kind,itemId:id,at:Date.now()});
  t.recentChanges=t.recentChanges.slice(0,20);
  save();
}

const undoableActionsV7=new Map([
  ["move-activity-step-v3","itinerary move"],
  ["skip-activity-v4","activity status"],
  ["delay-activity-v4","activity delay"],
  ["reset-delay-v4","activity delay"],
  ["duplicate-day-v3","day duplication"]
]);

document.addEventListener("click",event=>{
  const el=event.target.closest("[data-action]");
  if(!el)return;
  const label=undoableActionsV7.get(el.dataset.action);
  if(label)pushUndoV7(label);
},true);

/* ---------- Smart planning math ---------- */
function haversineKmV7(a,b) {
  if(!a?.lat||!a?.lng||!b?.lat||!b?.lng)return null;
  const R=6371,rad=x=>Number(x)*Math.PI/180;
  const dLat=rad(b.lat-a.lat),dLon=rad(b.lng-a.lng);
  const la1=rad(a.lat),la2=rad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

function roughTravelMinutesV7(a,b,pace="comfortable") {
  const km=haversineKmV7(a,b);
  if(km==null)return Number(b?.travelTime||0);
  const buffer=pace==="relaxed"?14:pace==="busy"?6:10;
  return Math.max(5,Math.round(km*3+buffer));
}

function priorityWeightV7(p) {
  return p.priority==="Must go"?0:p.favorite?1:p.priority==="Want"?2:3;
}

function nearestOrderV7(items) {
  const left=[...items];
  if(left.length<2)return left;
  left.sort((a,b)=>priorityWeightV7(a)-priorityWeightV7(b));
  const ordered=[left.shift()];
  while(left.length){
    const cur=ordered.at(-1);
    left.sort((a,b)=>{
      const da=haversineKmV7(cur,a),db=haversineKmV7(cur,b);
      if(da==null&&db==null)return priorityWeightV7(a)-priorityWeightV7(b);
      if(da==null)return 1;if(db==null)return -1;
      return da-db || priorityWeightV7(a)-priorityWeightV7(b);
    });
    ordered.push(left.shift());
  }
  return ordered;
}

function dayBudgetV7(date,t=trip()) {
  const own=Number(t.dayBudgets?.[date]||0);
  return own>0?own:Number(t.dailyBudget||0);
}

function plannedCostDateV7(date,t=trip()) {
  return activitiesOn(date,t).reduce((s,x)=>s+Number(x.estimatedCost||0),0);
}

function dayIntensityV7(date,t=trip()) {
  const rows=activitiesOn(date,t).filter(x=>!x.skipped);
  const activeMinutes=rows.reduce((s,x)=>s+Number(x.duration||0)+Number(x.travelTime||0),0);
  const score=activeMinutes+rows.length*18;
  if(rows.length<=3&&score<300)return{key:"relaxed",icon:"🌿",label:"Relaxed",score,minutes:activeMinutes};
  if(rows.length<=6&&score<500)return{key:"comfortable",icon:"🌸",label:"Comfortable",score,minutes:activeMinutes};
  if(rows.length<=8&&score<680)return{key:"busy",icon:"🍓",label:"Busy",score,minutes:activeMinutes};
  return{key:"packed",icon:"🔥",label:"Packed",score,minutes:activeMinutes};
}

function placeScheduledV7(place,t=trip()) {
  return t.itinerary.some(a=>a.sourcePlaceId===place.id || `${a.title} ${a.place}`.toLowerCase().includes(String(place.name||"").toLowerCase()));
}

function unscheduledPlacesV7(t=trip()) {
  return t.places.filter(p=>!p.visited&&!placeScheduledV7(p,t)).sort((a,b)=>priorityWeightV7(a)-priorityWeightV7(b)||a.name.localeCompare(b.name));
}

function typeFromPlaceV7(p) {
  const c=String(p.category||"").toLowerCase();
  if(/cafe|café/.test(c))return"cafe";
  if(/food|restaurant/.test(c))return"food";
  if(/shop|store|mall/.test(c))return"shopping";
  if(/attraction|temple|museum|park/.test(c))return"attraction";
  return"place";
}

function localSmartWarningsV7(date,t=trip()) {
  const warnings=[];
  const rows=activitiesOn(date,t).filter(x=>!x.skipped);

  for(let i=1;i<rows.length;i++){
    const prev=rows[i-1],cur=rows[i];
    const km=haversineKmV7(prev,cur);
    if(km!=null && km>=20) warnings.push({
      severity:km>=40?"high":"medium",icon:"🗺️",
      title:`${prev.title} → ${cur.title} is a long jump`,
      detail:`The saved coordinates are about ${km.toFixed(km>=10?0:1)} km apart in a straight line. Check the real route before travel day.`
    });
  }

  const fixed=rows.filter(x=>!x.flexible&&x.time);
  (t.bookings||[]).filter(b=>b.date===date&&b.time&&b.status!=="Cancelled").forEach(b=>{
    const bs=minutesFromTime(b.time),be=b.endDate===date&&b.endTime?minutesFromTime(b.endTime):bs+60;
    fixed.forEach(a=>{
      const as=minutesFromTime(a.time),ae=as+Number(a.duration||60);
      if(Math.max(as,bs)<Math.min(ae,be) && !String(a.title).toLowerCase().includes(String(b.title).toLowerCase())) {
        warnings.push({severity:"high",icon:"🎟️",title:`Booking overlaps ${a.title}`,detail:`${b.title} at ${formatTimeV3(b.time)} overlaps this itinerary block.`});
      }
    });
  });

  const sourceIds=rows.map(x=>x.sourcePlaceId).filter(Boolean);
  [...new Set(sourceIds)].forEach(id=>{
    if(sourceIds.filter(x=>x===id).length>1){
      const p=t.places.find(x=>x.id===id);
      warnings.push({severity:"low",icon:"↻",title:`${p?.name||"A saved place"} appears more than once`,detail:"Review the day in case this duplicate was accidental."});
    }
  });

  const budget=dayBudgetV7(date,t),planned=plannedCostDateV7(date,t),actual=spentDate(date,t);
  if(budget>0&&planned>budget)warnings.push({severity:"medium",icon:"💴",title:"Planned cost is above this day's budget",detail:`Expected ${money(planned)} vs ${money(budget)} day budget.`});
  if(budget>0&&actual>budget)warnings.push({severity:"high",icon:"💸",title:"Today's spending is above the day budget",detail:`Actual spending is ${money(actual)} vs ${money(budget)}.`});

  return warnings;
}

/* Upgrade the Build 4 warning engine everywhere it is already used. */
const scheduleWarningsBeforeV7 = scheduleWarningsV4;
scheduleWarningsV4 = function scheduleWarningsSmartV7(date,t=trip()) {
  const base=typeof scheduleWarningsBeforeV7==="function"?scheduleWarningsBeforeV7(date,t):[];
  const all=[...base,...localSmartWarningsV7(date,t)];
  const seen=new Set();
  return all.filter(x=>{
    const k=`${x.title}|${x.detail}`;
    if(seen.has(k))return false;
    seen.add(k);return true;
  });
};

/* ---------- Forms upgraded for planning + memories ---------- */
activityFormHTMLV2 = function activityFormHTMLV7(item={}) {
  const t=trip(),mode=item.daypart||(item.flexible?"Anytime":"Fixed");
  return `<form id="activityFormV7" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row"><label>DATE</label><input name="date" type="date" value="${item.date||state.activeItineraryDate||activeDate(t)}" required></div>
    <div class="form-row two"><div><label>SCHEDULE</label><select name="daypart">${["Fixed","Morning","Afternoon","Evening","Anytime"].map(x=>`<option ${mode===x?"selected":""}>${x}</option>`).join("")}</select></div><div><label>TIME</label><input name="time" type="time" value="${item.time||""}"></div></div>
    <div class="form-row two"><div><label>DURATION (MIN)</label><input name="duration" type="number" min="0" step="5" value="${item.duration||60}"></div><div><label>TRAVEL BEFORE (MIN)</label><input name="travelTime" type="number" min="0" step="5" value="${item.travelTime||0}"></div></div>
    <div class="form-row two"><div><label>EXPECTED COST (${t.baseCurrency})</label><input name="estimatedCost" type="number" min="0" step=".01" value="${Number(item.estimatedCost||0)}"></div><div><label>TYPE</label><select name="type">${[["place","Place"],["cafe","Café"],["food","Food"],["transport","Transport"],["attraction","Attraction"],["shopping","Shopping"]].map(([v,l])=>`<option value="${v}" ${item.type===v?"selected":""}>${l}</option>`).join("")}</select></div></div>
    <label class="check-inline-v3"><input name="favorite" type="checkbox" ${item.favorite?"checked":""}> ⭐ Favorite / highlight this activity</label>
    <input name="sourcePlaceId" type="hidden" value="${esc(item.sourcePlaceId||"")}">
    <div class="form-row"><label>ACTIVITY</label><input name="title" required value="${esc(item.title||"")}" placeholder="Hasedera Temple"></div>
    <div class="form-row"><label>PLACE / AREA</label><input name="place" value="${esc(item.place||"")}" placeholder="Kamakura"></div>
    <div class="form-row"><label>ADDRESS</label><input name="address" value="${esc(item.address||"")}" placeholder="Optional"></div>
    <div class="form-row two"><div><label>LATITUDE</label><input name="lat" type="number" step="any" value="${item.lat??""}"></div><div><label>LONGITUDE</label><input name="lng" type="number" step="any" value="${item.lng??""}"></div></div>
    <div class="form-row"><label>NOTES</label><textarea name="notes">${esc(item.notes||"")}</textarea></div>
    <button class="btn primary">${item.id?"Save activity":"Add to itinerary"}</button>
  </form>`;
};

placeFormHTMLV2 = function placeFormHTMLV7(item={}) {
  return `<form id="placeFormV7" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row"><label>PLACE NAME</label><input name="name" required value="${esc(item.name||"")}" placeholder="Pokémon Café"></div>
    <div class="form-row two"><div><label>AREA</label><input name="area" value="${esc(item.area||"")}" placeholder="Nihonbashi"></div><div><label>CATEGORY</label><select name="category">${placeCategoryOptions(item.category||"Café")}</select></div></div>
    <div class="form-row two"><div><label>PRIORITY</label><select name="priority">${["Must go","Want","Maybe"].map(x=>`<option ${item.priority===x?"selected":""}>${x}</option>`).join("")}</select></div><div><label>OPENING HOURS</label><input name="openingHours" value="${esc(item.openingHours||"")}" placeholder="10:00–20:00"></div></div>
    <div class="form-row two"><div><label>EXPECTED VISIT (MIN)</label><input name="estimatedDuration" type="number" min="15" step="15" value="${Number(item.estimatedDuration||90)}"></div><div><label>EXPECTED SPEND</label><input name="estimatedCost" type="number" min="0" step=".01" value="${Number(item.estimatedCost||0)}"></div></div>
    <label class="check-inline-v3"><input name="favorite" type="checkbox" ${item.favorite?"checked":""}> ⭐ Favorite</label>
    <div class="form-row"><label>ADDRESS</label><input name="address" value="${esc(item.address||"")}"></div>
    <div class="form-row two"><div><label>LATITUDE</label><input name="lat" type="number" step="any" value="${item.lat??""}"></div><div><label>LONGITUDE</label><input name="lng" type="number" step="any" value="${item.lng??""}"></div></div>
    <button class="btn soft" type="button" data-action="fill-current-location-v2" data-target-form="placeFormV7">◎ Use my current coordinates</button>
    <div class="form-row"><label>MAP LINK</label><input name="mapUrl" type="url" value="${esc(item.mapUrl||"")}" placeholder="Optional Google/Apple Maps link"></div>
    <div class="form-row"><label>RESERVATION LINK</label><input name="reservationUrl" type="url" value="${esc(item.reservationUrl||"")}" placeholder="Optional reservation link"></div>
    <div class="form-row"><label>TAGS</label><input name="tags" value="${esc((item.tags||[]).join(", "))}" placeholder="ramen, rainy day, shinjuku"></div>
    <div class="form-row"><label>NOTES</label><textarea name="notes">${esc(item.notes||"")}</textarea></div>
    <button class="btn primary">${item.id?"Save place":"Save place"}</button>
  </form>`;
};

function randomJournalPromptV7() {
  const arr=window.ICHIGO_DATA?.journalPromptsV7||window.ICHIGO_DATA?.journalPrompts||[];
  return arr[Math.floor(Math.random()*Math.max(1,arr.length))]||"Favorite little moment";
}

memoryFormHTMLV2 = function memoryFormHTMLV7(item={}) {
  const t=trip(),prompts=window.ICHIGO_DATA?.journalPromptsV7||window.ICHIGO_DATA?.journalPrompts||[];
  return `<form id="memoryFormV7" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row two"><div><label>DATE</label><input name="date" type="date" value="${item.date||activeDate(t)}" required></div><div><label>TIME</label><input name="time" type="time" value="${item.time||""}"></div></div>
    <div class="form-row two"><div><label>TYPE</label><select name="memoryType">${["Moment","Food","Place","Shopping","Stay","Transit"].map(x=>`<option ${item.memoryType===x?"selected":""}>${x}</option>`).join("")}</select></div><div><label>PROMPT</label><select name="prompt"><option value="">No prompt</option>${prompts.map(x=>`<option value="${esc(x)}" ${item.prompt===x?"selected":""}>${esc(x)}</option>`).join("")}</select></div></div>
    <label class="check-inline-v3"><input name="favorite" type="checkbox" ${item.favorite?"checked":""}> ⭐ Favorite moment</label>
    <div class="form-row"><label>TITLE</label><input name="title" value="${esc(item.title||"")}" placeholder="Enoshima sunset"></div>
    <div class="form-row"><label>JOURNAL NOTE</label><textarea name="note" placeholder="A tiny memory from today...">${esc(item.note||"")}</textarea></div>
    <div class="form-row"><label>LOCATION / PLACE</label><input name="location" value="${esc(item.location||"")}" placeholder="Enoshima, Kanagawa"></div>
    <div class="form-row two"><div><label>LATITUDE</label><input name="lat" type="number" step="any" value="${item.lat??""}"></div><div><label>LONGITUDE</label><input name="lng" type="number" step="any" value="${item.lng??""}"></div></div>
    <button class="btn soft" type="button" data-action="fill-current-location-v2" data-target-form="memoryFormV7">◎ Use current location</button>
    <div class="form-row"><label>PHOTO</label><input name="photo" type="file" accept="image/*"><small class="inline-help">Stored locally. Leave blank while editing to keep the current photo.</small></div>
    <button class="btn primary">${item.id?"Save memory":"Save memory"}</button>
  </form>`;
};

/* ---------- Smart planner UI ---------- */
function planMyDayModalV7(date=state.activeItineraryDate||activeDate()) {
  const places=unscheduledPlacesV7();
  if(!places.length){notify("All your unvisited saved places are already scheduled.");return}
  const pref=state.planMyDay||{};
  openModal("🍓 Plan My Day",`<form id="planMyDayFormV7" class="form-grid">
    <div class="notice-card"><span class="notice-icon">🍓</span><span><strong>Local smart planning</strong><p>Ichigo uses your saved coordinates, priorities, expected visit lengths and a rough straight-line travel estimate. Always verify real transit times.</p></span></div>
    <div class="form-row two"><div><label>DAY</label><select name="date">${allDates().map(d=>`<option value="${d}" ${d===date?"selected":""}>Day ${dayNo(d)} · ${nice(d)}</option>`).join("")}</select></div><div><label>START</label><input name="startTime" type="time" value="${pref.startTime||"09:00"}"></div></div>
    <div class="form-row"><label>PACE</label><select name="pace">${(window.ICHIGO_DATA?.planningPacesV7||[]).map(x=>`<option value="${x.id}" ${x.id===(pref.pace||"comfortable")?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div>
    <label class="check-inline-v3"><input name="replaceDay" type="checkbox"> Replace activities already on this day</label>
    <div class="planner-select-list-v7">${places.map(p=>`<label class="planner-place-option-v7"><input type="checkbox" name="placeIds" value="${p.id}" ${p.priority==="Must go"||p.favorite?"checked":""}><span>${p.priority==="Must go"?"❤️":p.favorite?"⭐":"📍"}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.area||p.category)} · ~${formatDuration(p.estimatedDuration)}${p.estimatedCost?` · ${money(p.estimatedCost)}`:""}</small></span></label>`).join("")}</div>
    <button class="btn primary">Build this day</button>
  </form>`);
}

function buildDayFromPlacesV7({date,startTime,pace,replaceDay,placeIds}) {
  const t=trip(),selected=placeIds.map(id=>t.places.find(p=>p.id===id)).filter(Boolean);
  if(!selected.length){notify("Choose at least one saved place.");return false}
  pushUndoV7("Plan My Day");

  if(replaceDay)t.itinerary=t.itinerary.filter(a=>a.date!==date);
  const ordered=nearestOrderV7(selected);
  const profile=(window.ICHIGO_DATA?.planningPacesV7||[]).find(x=>x.id===pace)||{buffer:10};
  let cursor=minutesFromTime(startTime)||540;
  const startOrder=activitiesOn(date,t).length;

  ordered.forEach((p,index)=>{
    const prev=index?ordered[index-1]:null;
    const travel=prev?roughTravelMinutesV7(prev,p,pace):0;
    cursor+=travel;
    const duration=Math.max(15,Number(p.estimatedDuration||90));
    t.itinerary.push({
      id:uuid(),date,time:timeFromMinutes(cursor),daypart:"Fixed",
      duration,travelTime:travel,type:typeFromPlaceV7(p),title:p.name,place:p.area||p.name,
      address:p.address||"",notes:p.notes||"",flexible:false,lat:p.lat,lng:p.lng,
      sourcePlaceId:p.id,estimatedCost:Number(p.estimatedCost||0),favorite:!!p.favorite,
      order:startOrder+index,completed:false,skipped:false,completedAt:"",arrivedAt:""
    });
    cursor+=duration+Number(profile.buffer||0);
  });

  renumberDay(date,t);
  state.activeItineraryDate=date;
  state.planMyDay={pace,startTime};
  markChangedV7(`Planned Day ${dayNo(date,t)} with ${ordered.length} saved place${ordered.length===1?"":"s"}`,"itinerary");
  return true;
}

function smartPlannerHTMLV7() {
  const t=trip(),date=state.activeItineraryDate||activeDate(t),unscheduled=unscheduledPlacesV7(t),must=unscheduled.filter(p=>p.priority==="Must go");
  const mapped=t.itinerary.filter(a=>a.lat&&a.lng).length;
  return `<div class="planner-hero-v7">
    <div><p class="eyebrow">SMART PERSONAL PLANNER</p><h2>Build a sweeter day 🍓</h2><p>Uses only the information saved in Ichigo. No AI API, account or paid service required.</p></div>
    <button class="btn primary" data-action="open-plan-day-v7" data-date="${date}">🍓 Plan My Day</button>
  </div>
  <div class="planner-summary-grid-v7">
    <div class="card"><span>❤️</span><strong>${must.length}</strong><small>Must-Go unscheduled</small></div>
    <div class="card"><span>📍</span><strong>${unscheduled.length}</strong><small>Places unscheduled</small></div>
    <div class="card"><span>🗺️</span><strong>${mapped}</strong><small>Mapped activities</small></div>
    <div class="card"><span>💴</span><strong>${money(plannedCostDateV7(date,t))}</strong><small>Expected Day ${dayNo(date,t)}</small></div>
  </div>
  <section class="section"><div class="section-title"><h3>❤️ Must-Go planner</h3><button data-action="open-plan-day-v7" data-date="${date}">Plan</button></div>${must.length?`<div class="smart-place-tray-v7">${must.map(p=>smartPlaceMiniV7(p,date)).join("")}</div>`:empty("❤️","Must-Go list is scheduled","Your current Must-Go places are already represented in the itinerary.")}</section>
  <section class="section"><div class="section-title"><h3>📍 Unscheduled places</h3><span class="meta">${unscheduled.length}</span></div>${unscheduled.length?`<div class="smart-place-tray-v7">${unscheduled.map(p=>smartPlaceMiniV7(p,date)).join("")}</div>`:empty("🌸","Nothing waiting","All saved unvisited places have an itinerary slot.")}</section>
  <section class="section"><div class="card smart-how-v7"><h3>How local route ordering works</h3><p>When coordinates exist, Ichigo uses a nearest-next-place order and estimates travel using straight-line distance plus a small buffer. It does <strong>not</strong> know train schedules, traffic, station entrances or actual walking routes, so treat it as a planning helper—not navigation.</p></div></section>`;
}

function smartPlaceMiniV7(p,date) {
  return `<article class="smart-place-v7"><div><span class="badge ${p.priority==="Must go"?"gold":"gray"}">${esc(p.priority)}</span><h4>${p.favorite?"⭐ ":""}${esc(p.name)}</h4><p>${esc(p.area||p.category)}${p.openingHours?` · ${esc(p.openingHours)}`:""}</p><small>~${formatDuration(p.estimatedDuration)}${p.estimatedCost?` · ${money(p.estimatedCost)}`:""}${p.lat&&p.lng?" · mapped":""}</small></div><button class="tiny-btn primary" data-action="add-place-day-v7" data-place-id="${p.id}" data-date="${date}">＋ Day ${dayNo(date)}</button></article>`;
}

function addPlaceToDayV7(placeId,date) {
  const t=trip(),p=t.places.find(x=>x.id===placeId);if(!p)return;
  pushUndoV7("add saved place");
  const items=activitiesOn(date,t),last=items.filter(x=>x.time&&!x.flexible).at(-1);
  const travel=last?roughTravelMinutesV7(last,p):0;
  const start=last?minutesFromTime(last.time)+Number(last.duration||60)+travel:600;
  t.itinerary.push({
    id:uuid(),date,time:timeFromMinutes(start),daypart:"Fixed",duration:Number(p.estimatedDuration||90),
    travelTime:travel,type:typeFromPlaceV7(p),title:p.name,place:p.area||p.name,address:p.address||"",
    notes:p.notes||"",flexible:false,lat:p.lat,lng:p.lng,sourcePlaceId:p.id,
    estimatedCost:Number(p.estimatedCost||0),favorite:!!p.favorite,order:items.length,
    completed:false,skipped:false
  });
  renumberDay(date,t);state.activeItineraryDate=date;markChangedV7(`Added ${p.name} to Day ${dayNo(date,t)}`,"itinerary");
  render();
}

function optimizeRouteV7(date) {
  const t=trip(),items=activitiesOn(date,t);
  const mapped=items.filter(x=>x.lat&&x.lng);
  if(mapped.length<2){notify("Add coordinates to at least two activities first.");return}
  pushUndoV7("route order");

  const optimized=nearestOrderV7(mapped);
  const unmapped=items.filter(x=>!x.lat||!x.lng);
  const combined=[...optimized,...unmapped];

  combined.forEach((x,i)=>{
    x.order=i;
    if(i===0)x.travelTime=0;
    else x.travelTime=roughTravelMinutesV7(combined[i-1],x);
  });
  renumberDay(date,t);markChangedV7(`Optimized Day ${dayNo(date,t)} route order`,"itinerary");render();notify("Route order updated. Check real transit before travel.");
}

function pushLaterModalV7(id) {
  const item=trip().itinerary.find(x=>x.id===id);if(!item)return;
  openModal("Push the Day Later",`<form id="pushLaterFormV7" data-id="${id}" class="form-grid">
    <p class="meta">Moves this activity and every later fixed-time activity on the same day.</p>
    <div class="form-row"><label>DELAY</label><select name="minutes">${[15,30,60,90,120].map(x=>`<option value="${x}">+${x} minutes</option>`).join("")}</select></div>
    <button class="btn primary">Push later</button>
  </form>`);
}

function applyPushLaterV7(id,minutes) {
  const t=trip(),item=t.itinerary.find(x=>x.id===id);if(!item)return;
  pushUndoV7("push day later");
  const day=activitiesOn(item.date,t),startIndex=day.findIndex(x=>x.id===id);
  day.slice(Math.max(0,startIndex)).forEach(x=>{
    if(x.time&&!x.flexible){
      x.originalTime ||= x.time;
      x.time=timeFromMinutes(minutesFromTime(x.time)+minutes);
      x.delayMinutes=Number(x.delayMinutes||0)+minutes;
    }
  });
  markChangedV7(`Pushed Day ${dayNo(item.date,t)} later by ${minutes} minutes`,"itinerary");
}

/* ---------- Itinerary 5.0 ---------- */
function activityCardV7(i) {
  const schedule=i.flexible?(i.daypart||"Anytime"):formatTimeV3(i.time||"");
  return `<article class="itinerary-card ${i.completed?"activity-complete-v3":""} ${i.skipped?"activity-skipped-v4":""}" data-activity-id="${i.id}" data-date="${i.date}">
    <button class="drag-handle" data-action="drag-activity-v2" data-id="${i.id}" aria-label="Drag ${esc(i.title)} to reorder">⋮⋮</button>
    <div class="activity-time">${esc(schedule)}${i.delayMinutes?`<small>+${i.delayMinutes}m</small>`:""}</div>
    <div class="activity-main">
      <h4>${i.favorite?"⭐ ":""}${i.completed?"✓ ":""}${i.skipped?"↷ ":""}${ICON[i.type]||"📍"} ${esc(i.title)}</h4>
      <p>${esc(i.place||i.address||"")}${i.notes?` · ${esc(i.notes)}`:""}</p>
      <div class="activity-meta">
        ${i.duration?`<span class="badge gray">⏱ ${formatDuration(i.duration)}</span>`:""}
        ${i.travelTime?`<span class="badge gray">🚃 ~${formatDuration(i.travelTime)}</span>`:""}
        ${i.estimatedCost?`<span class="badge gold">💴 ${money(i.estimatedCost)}</span>`:""}
        ${i.flexible?`<span class="badge gold">${esc(i.daypart||"Flexible")}</span>`:""}
        ${i.completed?`<span class="badge green">Done</span>`:""}${i.skipped?`<span class="badge gray">Skipped</span>`:""}
      </div>
      <div class="activity-actions">
        <button class="tiny-btn" data-action="toggle-favorite-v7" data-kind="activity" data-id="${i.id}">${i.favorite?"★":"☆"}</button>
        <button class="tiny-btn" data-action="move-activity-step-v3" data-id="${i.id}" data-step="-1">↑</button>
        <button class="tiny-btn" data-action="move-activity-step-v3" data-id="${i.id}" data-step="1">↓</button>
        <button class="tiny-btn" data-action="push-later-v7" data-id="${i.id}">Push later</button>
        <button class="tiny-btn" data-action="edit-activity-v2" data-id="${i.id}">Edit</button>
        <button class="tiny-btn" data-action="duplicate-activity-v2" data-id="${i.id}">Duplicate</button>
        <button class="tiny-btn" data-action="move-activity-v2" data-id="${i.id}">Move day</button>
        ${(i.address||i.lat||i.place)?`<a class="tiny-btn" href="${esc(preferredMapUrlV3(i))}" target="_blank" rel="noopener">Map</a>`:""}
        <button class="tiny-btn danger" data-action="delete-v2" data-collection="itinerary" data-id="${i.id}">Delete</button>
      </div>
    </div>
  </article>`;
}

function itineraryHTMLV7(date) {
  const t=trip();
  if(!allDates(t).includes(date))date=activeDate(t);
  state.activeItineraryDate=date;
  const items=activitiesOn(date,t),intensity=dayIntensityV7(date,t),warnings=scheduleWarningsV4(date,t);
  const totalDuration=items.filter(x=>!x.skipped).reduce((s,x)=>s+Number(x.duration||0),0);
  const travel=items.filter(x=>!x.skipped).reduce((s,x)=>s+Number(x.travelTime||0),0);
  const collapsed=!!state.collapsedDays[`${t.id}:${date}`];
  const budget=dayBudgetV7(date,t),planned=plannedCostDateV7(date,t),actual=spentDate(date,t);
  const unscheduled=unscheduledPlacesV7(t).slice(0,5);

  return `<div class="section-title"><h3>🗓️ Itinerary</h3><div class="section-actions-v3">
    <button data-action="open-plan-day-v7" data-date="${date}">🍓 Plan My Day</button>
    <button data-action="optimize-route-v7" data-date="${date}">🗺 Route order</button>
    <button data-action="save-day-template-v4" data-date="${date}">Save day</button>
    <button data-action="use-day-template-v4" data-date="${date}">Use template</button>
    <button data-action="duplicate-day-v3" data-date="${date}">Duplicate</button>
    <button data-action="quick-add-type" data-type="activity">＋ Activity</button>
  </div></div>
  <div class="chips">${allDates(t).map(d=>`<button class="chip ${d===date?"active":""}" data-action="show-itinerary-date-v3" data-date="${d}">Day ${dayNo(d,t)} · ${nice(d,{month:"short",day:"numeric"})}</button>`).join("")}</div>

  <div class="day-smart-strip-v7">
    <div class="intensity-pill-v7 ${intensity.key}"><span>${intensity.icon}</span><strong>${intensity.label}</strong><small>${formatDuration(intensity.minutes)} active</small></div>
    <button class="day-budget-pill-v7" data-action="edit-day-budgets-v7"><span>💴 Day budget</span><strong>${budget?money(budget):"Not set"}</strong><small>${money(actual)} actual · ${money(planned)} expected</small></button>
  </div>

  ${warnings.length?`<div class="schedule-warnings-v4">${warnings.map(w=>`<div class="notice-card ${w.severity==="high"?"danger":""}"><span class="notice-icon">${w.icon}</span><span><strong>${esc(w.title)}</strong><p>${esc(w.detail)}</p></span></div>`).join("")}</div>`:""}

  <div id="itineraryDay"><div class="day-summary day-summary-v3" data-action="toggle-day-collapse-v3" data-date="${date}" role="button" tabindex="0" aria-expanded="${!collapsed}">
    <div><strong>${items.length}</strong><small>activities</small></div><div><strong>${formatDuration(totalDuration)||"—"}</strong><small>planned</small></div><div><strong>${formatDuration(travel)||"—"}</strong><small>rough travel</small></div><span>${collapsed?"Show":"Hide"} day</span>
  </div>
  ${collapsed?`<div class="collapsed-day-v3">Day collapsed · ${items.length} activities</div>`:items.length?`<div data-itinerary-date="${date}">${items.map(i=>`${i.travelTime&&!i.skipped?`<div class="travel-block-v3">🚃 ~${formatDuration(i.travelTime)} before this stop</div>`:""}${activityCardV7(i)}`).join("")}</div>`:empty("🗓️","Nothing planned yet","Use Plan My Day, add an activity, or pull a saved place into this day.")}</div>

  ${unscheduled.length?`<section class="section"><div class="section-title"><h3>📍 Waiting to be scheduled</h3><button data-action="set-plan-view" data-feature="smart">See all</button></div><div class="smart-place-tray-v7">${unscheduled.map(p=>smartPlaceMiniV7(p,date)).join("")}</div></section>`:""}`;
}

activityCardV2 = activityCardV7;
itineraryHTML = itineraryHTMLV7;

/* ---------- Trip Notes + scratchpad ---------- */
function notesHTMLV7() {
  const t=trip(),notes=[...t.quickNotes].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.createdAt-a.createdAt);
  return `<div class="section-title"><h3>📝 Trip Notes</h3><span class="meta">local only</span></div>
  <form id="tripNotesFormV7" class="card trip-notes-v7"><label>TRIP NOTEBOOK</label><textarea name="notes" placeholder="Big-picture notes, hotel reminders, things to remember...">${esc(t.tripNotes||"")}</textarea><button class="btn soft">Save Trip Notes</button></form>
  <section class="section"><div class="section-title"><h3>⚡ Scratchpad</h3><span class="meta">capture in seconds</span></div>
    <form id="scratchpadFormV7" class="scratch-add-v7"><input name="text" required placeholder="Cafe from TikTok · buy Suica · ask hotel about luggage..."><button class="btn primary">＋</button></form>
    <div class="scratch-list-v7">${notes.length?notes.map(n=>`<article class="scratch-card-v7 ${n.pinned?"pinned":""}"><button data-action="pin-scratch-v7" data-id="${n.id}" aria-label="Pin note">${n.pinned?"📌":"○"}</button><p>${esc(n.text)}</p><div><button class="tiny-btn" data-action="scratch-to-inbox-v7" data-id="${n.id}">→ Inbox</button><button class="tiny-btn danger" data-action="delete-scratch-v7" data-id="${n.id}">Delete</button></div></article>`).join(""):empty("⚡","Scratchpad is empty","Drop quick thoughts here without organizing them first.")}</div>
  </section>`;
}

/* ---------- Inbox conversion 5.0 ---------- */
function inboxHTMLV7() {
  const arr=[...trip().inbox].sort((a,b)=>Number(a.status==="archived")-Number(b.status==="archived")||b.createdAt-a.createdAt);
  return `<div class="section-title"><h3>📥 Trip Inbox</h3><button data-action="add-inbox-v3">＋ Capture</button></div>
    <div class="notice-card"><span class="notice-icon">💡</span><span><strong>Dump first, organize later.</strong><p>Turn any capture into a place, activity, booking, task or scratch note when you're ready.</p></span></div>
    <div class="list" style="margin-top:10px">${arr.length?arr.map(x=>`<article class="inbox-card-v3 ${x.status==="archived"?"archived":""}">
      ${x.fileKey?`<button class="inbox-thumb-v3" data-action="open-file-v2" data-file-key="${x.fileKey}" data-file-kind="image"><span>🖼️</span></button>`:`<div class="inbox-thumb-v3">📥</div>`}
      <div class="row-main"><div class="badge gray">${esc(x.type)}</div><h4>${esc(x.title)}</h4><p>${esc(x.note||"")}</p>${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener" class="inline-link-v3">Open saved link ↗</a>`:""}
        <div class="activity-actions"><button class="tiny-btn" data-action="edit-inbox-v3" data-id="${x.id}">Edit</button>${["Place","Activity","Booking","Task","Note"].map(k=>`<button class="tiny-btn" data-action="convert-inbox-v7" data-id="${x.id}" data-target="${k}">→ ${k}</button>`).join("")}<button class="tiny-btn" data-action="archive-inbox-v3" data-id="${x.id}">${x.status==="archived"?"Restore":"Archive"}</button><button class="tiny-btn danger" data-action="delete-inbox-v3" data-id="${x.id}">Delete</button></div>
      </div></article>`).join(""):empty("📥","Your Trip Inbox is empty","Capture anything you want to sort out later.")}</div>`;
}
inboxHTMLV3 = inboxHTMLV7;

function convertInboxV7(id,target) {
  const t=trip(),x=t.inbox.find(i=>i.id===id);if(!x)return;
  pushUndoV7("Inbox conversion");
  if(target==="Place"){
    t.places.push(ensureTripV7({places:[{id:uuid(),name:x.title,area:"",category:"Other",priority:"Want",favorite:false,openingHours:"",address:"",mapUrl:x.url||"",reservationUrl:"",tags:[],notes:x.note||"",votes:{},visited:false,estimatedDuration:90,estimatedCost:0}],itinerary:[],bookings:[],packing:[],preTrip:[],expenses:[],memories:[],essentials:{contacts:[],documents:[],phrases:[]}}).places[0]);
  } else if(target==="Activity"){
    t.itinerary.push({id:uuid(),date:state.activeItineraryDate||activeDate(t),time:"",daypart:"Anytime",duration:60,travelTime:0,type:"place",title:x.title,place:"",address:"",notes:[x.note,x.url].filter(Boolean).join(" · "),flexible:true,lat:null,lng:null,sourcePlaceId:"",estimatedCost:0,favorite:false,order:activitiesOn(state.activeItineraryDate||activeDate(t),t).length,completed:false,skipped:false});
  } else if(target==="Booking"){
    t.bookings.push({id:uuid(),type:"Reservation",title:x.title,date:activeDate(t),time:"",endDate:"",endTime:"",confirmation:"",address:"",link:x.url||"",status:"Saved",notes:x.note||"",attachmentKey:"",attachmentName:""});
  } else if(target==="Task"){
    t.preTrip.push({id:uuid(),name:x.title,detail:[x.note,x.url].filter(Boolean).join(" · "),done:false,category:"Other",priority:"Medium",dueDate:""});
  } else {
    t.quickNotes.push({id:uuid(),text:[x.title,x.note,x.url].filter(Boolean).join(" — "),pinned:false,createdAt:Date.now()});
  }
  x.status="archived";
  markChangedV7(`Converted Inbox item to ${target}`,"inbox",id);
  render();notify(`Added to ${target}`);
}

/* ---------- Day budgets ---------- */
function dayBudgetModalV7() {
  const t=trip();
  openModal("Daily Budgets",`<form id="dayBudgetsFormV7" class="form-grid">
    <p class="meta">Leave a day at 0 to use your default daily budget of ${money(t.dailyBudget)}.</p>
    ${allDates(t).map(d=>`<div class="form-row"><label>DAY ${dayNo(d,t)} · ${nice(d)}</label><input name="day_${d}" type="number" min="0" step=".01" value="${Number(t.dayBudgets[d]||0)}" placeholder="${Number(t.dailyBudget||0)}"></div>`).join("")}
    <button class="btn primary">Save day budgets</button>
  </form>`);
}

const budgetHTMLBeforeV7 = budgetHTML;
budgetHTML = function budgetHTMLV7() {
  const base=budgetHTMLBeforeV7();
  const t=trip(),rows=allDates(t);
  return `${base}<section class="section"><div class="section-title"><h3>🗓️ Day budgets</h3><button data-action="edit-day-budgets-v7">Edit</button></div><div class="day-budget-list-v7">${rows.map(d=>{const b=dayBudgetV7(d,t),a=spentDate(d,t),p=plannedCostDateV7(d,t),over=b>0&&(a>b||p>b);return`<div class="day-budget-row-v7 ${over?"over":""}"><div><strong>Day ${dayNo(d,t)}</strong><small>${nice(d,{month:"short",day:"numeric"})}</small></div><div><span>Budget</span><strong>${b?money(b):"—"}</strong></div><div><span>Expected</span><strong>${money(p)}</strong></div><div><span>Actual</span><strong>${money(a)}</strong></div></div>`}).join("")}</div></section>`;
};

/* ---------- Plan navigation ---------- */
const planHTMLBeforeV7 = planHTML;
planHTML = function planHTMLV7(v) {
  if(v==="smart")return smartPlannerHTMLV7();
  if(v==="notes")return notesHTMLV7();
  return planHTMLBeforeV7(v);
};

renderPlan = function renderPlanV7() {
  const menu=[
    ["itinerary","🗓️","Itinerary"],["smart","🍓","Smart Planner"],["inbox","📥","Inbox"],["notes","📝","Notes"],
    ["places","📍","Places"],["map","🗺️","Map"],["bookings","🎟️","Bookings"],["packing","🧳","Packing"],
    ["before","✅","Before You Go"],["essentials","🆘","Essentials"]
  ];
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">PLAN</p><h1>Plan your trip</h1><p>${esc(trip().title)}</p></div><button class="btn soft" data-action="open-quick-add">＋ Add</button></div><div class="chips">${menu.map(([k,e,l])=>`<button class="chip ${state.planView===k?"active":""}" data-action="set-plan-view" data-feature="${k}">${e} ${l}</button>`).join("")}</div><section class="section">${planHTML(state.planView)}</section>`;
};

/* ---------- Dashboard customization ---------- */
function dashboardWidgetHTMLV7(key) {
  const t=trip(),date=activeDate(t);
  if(key==="mustgo"){
    const n=unscheduledPlacesV7(t).filter(p=>p.priority==="Must go").length;
    return `<button class="dash-widget-v7" data-action="set-plan-view-home-v7" data-feature="smart"><span>❤️</span><strong>${n}</strong><small>Must-Go waiting</small></button>`;
  }
  if(key==="intensity"){
    const x=dayIntensityV7(date,t);
    return `<button class="dash-widget-v7" data-action="go-today-v7"><span>${x.icon}</span><strong>${x.label}</strong><small>Day ${dayNo(date,t)} intensity</small></button>`;
  }
  if(key==="daybudget"){
    const b=dayBudgetV7(date,t),a=spentDate(date,t);
    return `<button class="dash-widget-v7" data-action="set-spend-view-home-v7" data-feature="budget"><span>💴</span><strong>${b?money(Math.max(0,b-a)):"—"}</strong><small>Day budget left</small></button>`;
  }
  if(key==="scratchpad")return `<button class="dash-widget-v7" data-action="set-plan-view-home-v7" data-feature="notes"><span>⚡</span><strong>${t.quickNotes.length}</strong><small>Scratch notes</small></button>`;
  if(key==="recent")return `<button class="dash-widget-v7 wide" data-action="set-plan-view-home-v7" data-feature="notes"><span>🕘</span><strong>${esc(t.recentChanges[0]?.label||"No recent edits")}</strong><small>${t.recentChanges[0]?new Date(t.recentChanges[0].at).toLocaleString():"Changes you make will appear here"}</small></button>`;
  if(key==="storage")return `<button class="dash-widget-v7" data-action="open-storage-v7"><span>💾</span><strong id="dashboardStorageV7">…</strong><small>Local media</small></button>`;
  return "";
}

function dashboardExtraHTMLV7() {
  const widgets=state.settings.dashboardWidgets||DEFAULT_DASHBOARD_WIDGETS_V7;
  return `<section class="section dashboard-extra-v7"><div class="section-title"><h3>My quick dashboard</h3><button data-action="customize-dashboard-v7">Customize</button></div><div class="dashboard-grid-v7">${widgets.map(dashboardWidgetHTMLV7).join("")}</div></section>`;
}

const renderHomeBeforeV7 = renderHome;
renderHome = function renderHomeV7() {
  renderHomeBeforeV7();
  main.insertAdjacentHTML("beforeend",dashboardExtraHTMLV7());
};

function dashboardCustomizeModalV7() {
  const defs=window.ICHIGO_DATA?.dashboardWidgetsV7||[];
  const selected=new Set(state.settings.dashboardWidgets||[]);
  openModal("Customize Dashboard",`<form id="dashboardFormV7" class="form-grid"><p class="meta">Choose the extra personal cards shown under your Home travel shelf.</p><div class="dashboard-choices-v7">${defs.map(x=>`<label><input type="checkbox" name="widgets" value="${x.id}" ${selected.has(x.id)?"checked":""}><span>${x.icon}</span><span><strong>${esc(x.label)}</strong><small>${esc(x.description)}</small></span></label>`).join("")}</div><button class="btn primary">Save dashboard</button></form>`);
}

async function updateDashboardStorageV7(){
  const el=document.querySelector("#dashboardStorageV7");if(!el||!window.IchigoDB)return;
  try{const s=await IchigoDB.stats();el.textContent=formatBytesV7(s.bytes)}catch{el.textContent="—"}
}

/* ---------- Memories 6.0 ---------- */
function memoryCardV7(m) {
  return `<article class="card memory-card ${m.favorite?"favorite-memory-v7":""}">
    ${m.photoKey?`<button class="memory-photo" data-action="open-file-v2" data-file-key="${m.photoKey}" data-file-kind="image"><span class="file-placeholder">📸</span></button>`:m.image?`<img class="memory-photo" src="${m.image}" alt="">`:`<div class="memory-photo memory-placeholder-v7">${m.memoryType==="Food"?"🍜":"📸"}</div>`}
    <div class="memory-body"><div class="memory-badges-v7"><span class="badge gray">${esc(m.memoryType||"Moment")}</span>${m.favorite?`<span class="badge gold">⭐ Favorite</span>`:""}</div><h4>${esc(m.title||"Little memory")}</h4>${m.prompt?`<small class="memory-prompt-v7">${esc(m.prompt)}</small>`:""}<p>${esc(m.note||"")}</p><div class="journal-location">🗓 ${nice(m.date)}${m.time?` · ${esc(formatTimeV3(m.time))}`:""}${m.location?` · 📍 ${esc(m.location)}`:""}</div><div class="activity-actions"><button class="tiny-btn" data-action="toggle-favorite-v7" data-kind="memory" data-id="${m.id}">${m.favorite?"★":"☆"}</button><button class="tiny-btn" data-action="edit-memory-v2" data-id="${m.id}">Edit</button><button class="tiny-btn danger" data-action="delete-v2" data-collection="memories" data-id="${m.id}">Delete</button></div></div>
  </article>`;
}

function memoriesHTMLV7() {
  const t=trip(),filter=state.memoryFilter||"all";
  let arr=[...t.memories].sort((a,b)=>`${b.date} ${b.time||""}`.localeCompare(`${a.date} ${a.time||""}`));
  if(filter==="favorites")arr=arr.filter(x=>x.favorite);
  if(filter==="food")arr=arr.filter(x=>x.memoryType==="Food");
  const prompt=randomJournalPromptV7();
  return `<div class="section-title"><h3>📸 Travel Journal</h3><div><button data-action="prompt-memory-v7" data-prompt="${esc(prompt)}">✨ Prompt me</button><button data-action="quick-add-type" data-type="memory">＋ Memory</button></div></div>
    <div class="journal-prompt-card-v7"><span>✨</span><div><small>JOURNAL PROMPT</small><strong>${esc(prompt)}</strong></div><button data-action="prompt-memory-v7" data-prompt="${esc(prompt)}">Write</button></div>
    <div class="chips">${[["all","All"],["favorites","⭐ Favorites"],["food","🍜 Food"]].map(([k,l])=>`<button class="chip ${filter===k?"active":""}" data-action="memory-filter-v7" data-filter="${k}">${l}</button>`).join("")}</div>
    ${arr.length?`<div class="grid-2 memory-grid-v7">${arr.map(memoryCardV7).join("")}</div>`:empty("📸","Your travel journal starts here","Add photos and tiny notes as the trip unfolds.","memory")}`;
}
memoriesHTML = memoriesHTMLV7;

function timelineRowsV7(date,t=trip()) {
  const rows=[];
  activitiesOn(date,t).forEach(a=>rows.push({kind:"activity",time:a.time||"",order:a.flexible?30:10,title:a.title,detail:a.place||a.notes||"",icon:ICON[a.type]||"📍",favorite:a.favorite,id:a.id}));
  t.memories.filter(m=>m.date===date).forEach(m=>rows.push({kind:"memory",time:m.time||"",order:20,title:m.title||"Memory",detail:m.note||m.location||"",icon:m.memoryType==="Food"?"🍜":"📸",favorite:m.favorite,id:m.id,photoKey:m.photoKey}));
  t.expenses.filter(e=>e.date===date).forEach(e=>rows.push({kind:"expense",time:"",order:40,title:e.merchant||e.title,detail:`${money(e.amount)} · ${e.category}`,icon:expenseEmoji(e.category),id:e.id}));
  return rows.sort((a,b)=>{
    const at=a.time?minutesFromTime(a.time):9999+a.order,bt=b.time?minutesFromTime(b.time):9999+b.order;
    return at-bt;
  });
}

function timelineHTMLV7() {
  const t=trip(),date=allDates(t).includes(state.storyDate)?state.storyDate:activeDate(t);
  state.storyDate=date;
  const rows=timelineRowsV7(date,t);
  return `<div class="section-title"><h3>🕰️ Day Timeline</h3><span class="meta">plans + spending + memories</span></div>
    <div class="chips">${allDates(t).map(d=>`<button class="chip ${date===d?"active":""}" data-action="story-date-v7" data-date="${d}">Day ${dayNo(d,t)}</button>`).join("")}</div>
    <div class="story-day-summary-v7"><span>${dayIntensityV7(date,t).icon} ${dayIntensityV7(date,t).label}</span><span>💸 ${money(spentDate(date,t))}</span><span>📸 ${t.memories.filter(m=>m.date===date).length}</span></div>
    ${rows.length?`<div class="story-timeline-v7">${rows.map(r=>`<article class="story-row-v7 ${r.favorite?"favorite":""}"><div class="story-time-v7">${r.time?esc(formatTimeV3(r.time)):"Anytime"}</div><div class="story-dot-v7">${r.icon}</div><div class="story-content-v7"><strong>${r.favorite?"⭐ ":""}${esc(r.title)}</strong><p>${esc(r.detail)}</p>${r.photoKey?`<button class="story-photo-v7" data-action="open-file-v2" data-file-key="${r.photoKey}" data-file-kind="image"><span>📸</span></button>`:""}</div></article>`).join("")}</div>`:empty("🕰️","A quiet day","Your itinerary, expenses and memories will combine here automatically.")}`;
}

function foodDiaryHTMLV7() {
  const t=trip(),foodExpenses=t.expenses.filter(e=>normCat(e.category)==="Food"),foodMemories=t.memories.filter(m=>m.memoryType==="Food");
  const dates=[...new Set([...foodExpenses.map(x=>x.date),...foodMemories.map(x=>x.date)])].sort();
  return `<div class="section-title"><h3>🍜 Food Diary</h3><span class="meta">${foodExpenses.length} food expenses · ${foodMemories.length} food memories</span></div>
    ${dates.length?dates.map(d=>`<section class="food-day-v7"><div class="section-title"><h3>Day ${dayNo(d,t)} · ${nice(d)}</h3><span>${money(foodExpenses.filter(x=>x.date===d).reduce((s,x)=>s+Number(x.amount||0),0))}</span></div><div class="food-grid-v7">${foodMemories.filter(x=>x.date===d).map(memoryCardV7).join("")}${foodExpenses.filter(x=>x.date===d).map(e=>`<article class="card food-expense-v7"><span>🍽️</span><div><strong>${esc(e.merchant||e.title)}</strong><p>${money(e.amount)} · ${esc(e.payment||"")}</p>${e.notes?`<small>${esc(e.notes)}</small>`:""}</div></article>`).join("")}</div></section>`).join(""):empty("🍜","Your food diary is waiting","Mark memories as Food or record food expenses and they'll gather here automatically.")}`;
}

function highlightsHTMLV7() {
  const t=trip(),places=t.places.filter(x=>x.favorite),activities=t.itinerary.filter(x=>x.favorite),mem=t.memories.filter(x=>x.favorite);
  return `<div class="section-title"><h3>⭐ Trip Highlights</h3><span class="meta">${places.length+activities.length+mem.length} favorites</span></div>
    <div class="highlight-hero-v7"><span>🍓</span><div><h2>Your favorite little things</h2><p>Stars from planning and travel day collect here automatically.</p></div></div>
    <section class="section"><h3>📍 Favorite places</h3>${places.length?`<div class="highlight-list-v7">${places.map(p=>`<button data-action="toggle-favorite-v7" data-kind="place" data-id="${p.id}"><span>⭐</span><div><strong>${esc(p.name)}</strong><small>${esc(p.area||p.category)}</small></div></button>`).join("")}</div>`:empty("📍","No favorite places yet","Tap the star on places you love.")}</section>
    <section class="section"><h3>🗓️ Favorite activities</h3>${activities.length?`<div class="highlight-list-v7">${activities.map(a=>`<button data-action="toggle-favorite-v7" data-kind="activity" data-id="${a.id}"><span>⭐</span><div><strong>${esc(a.title)}</strong><small>Day ${dayNo(a.date,t)} · ${esc(a.place||"")}</small></div></button>`).join("")}</div>`:empty("🗓️","No favorite activities yet","Star an activity from your itinerary.")}</section>
    <section class="section"><h3>📸 Favorite memories</h3>${mem.length?`<div class="grid-2">${mem.map(memoryCardV7).join("")}</div>`:empty("📸","No favorite memories yet","Star the moments you never want to lose.")}</section>`;
}

function visitedMapHTMLV7() {
  const t=trip(),visited=t.places.filter(p=>p.visited&&p.lat&&p.lng),mem=t.memories.filter(m=>m.lat&&m.lng);
  return `<div class="section-title"><h3>🗺️ Visited Story Map</h3><span class="meta">${visited.length} visited places · ${mem.length} mapped memories</span></div>
    <div class="map-shell story-map-shell-v7"><div id="storyMapV7"></div>${!navigator.onLine?`<div class="map-overlay-note">Saved coordinates stay available offline. Background map tiles may only appear if they were cached during an earlier online visit.</div>`:""}</div>
    <div class="story-map-legend-v7"><span>📍 Visited place</span><span>📸 Memory</span></div>`;
}

function initStoryMapV7() {
  const el=document.querySelector("#storyMapV7");if(!el)return;
  if(typeof L==="undefined"){el.innerHTML=empty("🗺️","Map library unavailable","Reconnect once to load the map library. Your saved locations are still in Ichigo.");return}
  try{if(storyMapV7){storyMapV7.remove();storyMapV7=null}}catch{}
  const t=trip(),places=t.places.filter(p=>p.visited&&p.lat&&p.lng),mem=t.memories.filter(m=>m.lat&&m.lng),all=[...places,...mem];
  const fallback=all[0]?[all[0].lat,all[0].lng]:[35.6762,139.6503];
  storyMapV7=L.map(el,{zoomControl:true}).setView(fallback,11);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(storyMapV7);
  const bounds=[];
  places.forEach(p=>{L.marker([p.lat,p.lng]).addTo(storyMapV7).bindPopup(`<strong>📍 ${esc(p.name)}</strong><br>${esc(p.area||"")}`);bounds.push([p.lat,p.lng])});
  mem.forEach(m=>{L.circleMarker([m.lat,m.lng],{radius:7}).addTo(storyMapV7).bindPopup(`<strong>📸 ${esc(m.title||"Memory")}</strong><br>${esc(m.note||"")}`);bounds.push([m.lat,m.lng])});
  if(bounds.length>1)storyMapV7.fitBounds(bounds,{padding:[24,24],maxZoom:14});
  setTimeout(()=>storyMapV7?.invalidateSize(),80);
}

/* ---------- Automatic scrapbook + recap ---------- */
function scrapbookHTMLV7() {
  const t=trip(),days=allDates(t);
  return `<div class="section-title"><h3>📖 Automatic Scrapbook</h3><span class="meta">${t.memories.length} memories</span></div>
    <div class="scrapbook-cover-v7">${t.coverKey?`<div class="scrapbook-cover-photo-v7" data-file-key="${t.coverKey}"></div>`:""}<div><span>${esc(t.countryEmoji||"✈️")}</span><p class="eyebrow">TRAVEL STORY</p><h2>${esc(t.title)}</h2><p>${nice(t.startDate)} – ${nice(t.endDate,{month:"short",day:"numeric",year:"numeric"})}</p></div></div>
    ${days.map(d=>{
      const plans=activitiesOn(d,t),mem=t.memories.filter(m=>m.date===d),food=t.expenses.filter(e=>e.date===d&&normCat(e.category)==="Food"),hero=mem.find(m=>m.favorite&&m.photoKey)||mem.find(m=>m.photoKey),done=plans.filter(x=>x.completed).length;
      return `<article class="scrap-page-v7">
        <div class="scrap-page-head-v7"><div><small>DAY ${dayNo(d,t)}</small><h3>${nice(d,{weekday:"long",month:"long",day:"numeric"})}</h3></div><div><span>${dayIntensityV7(d,t).icon} ${dayIntensityV7(d,t).label}</span><span>💸 ${money(spentDate(d,t))}</span></div></div>
        ${hero?`<button class="scrap-hero-v7" data-action="open-file-v2" data-file-key="${hero.photoKey}" data-file-kind="image"><span>📸 ${esc(hero.title||"Favorite moment")}</span></button>`:""}
        <div class="scrap-stats-v7"><span>✓ ${done}/${plans.length} plans</span><span>📸 ${mem.length} memories</span><span>🍜 ${food.length} meals logged</span></div>
        ${plans.length?`<div class="scrap-route-v7">${plans.filter(x=>!x.skipped).map(x=>`<span>${ICON[x.type]||"📍"} ${esc(x.title)}</span>`).join("")}</div>`:""}
        ${mem.length?`<div class="scrap-memory-grid-v7">${mem.map(m=>m.photoKey?`<button data-action="open-file-v2" data-file-key="${m.photoKey}" data-file-kind="image"><span>${m.favorite?"⭐":"📸"}</span></button>`:`<div><span>${m.memoryType==="Food"?"🍜":"💭"}</span><small>${esc(m.title||"Memory")}</small></div>`).join("")}</div>`:""}
        ${mem.filter(m=>m.note).slice(0,3).map(m=>`<blockquote class="scrap-quote-v7">${m.favorite?"⭐ ":""}${esc(m.note)}</blockquote>`).join("")}
      </article>`;
    }).join("")}`;
}
scrapbookHTMLV2 = scrapbookHTMLV7;

function recapHTMLV7() {
  const t=trip(),total=spent(t),days=daysBetween(t.startDate,t.endDate),visited=t.places.filter(p=>p.visited),favorites=t.memories.filter(m=>m.favorite);
  const categories={};t.expenses.forEach(e=>categories[normCat(e.category)]=(categories[normCat(e.category)]||0)+Number(e.amount||0));
  const topCat=Object.entries(categories).sort((a,b)=>b[1]-a[1])[0];
  const busiest=allDates(t).map(d=>({date:d,intensity:dayIntensityV7(d,t),spend:spentDate(d,t)})).sort((a,b)=>b.intensity.score-a.intensity.score)[0];
  const meals=t.expenses.filter(e=>normCat(e.category)==="Food").length;
  return `<div class="recap-hero-v7"><span>${esc(t.countryEmoji||"✈️")}</span><p class="eyebrow">ICHIGO TRIP RECAP</p><h2>${esc(t.title)}</h2><p>${days} days · ${nice(t.startDate)} – ${nice(t.endDate,{month:"short",day:"numeric",year:"numeric"})}</p></div>
    <div class="recap-grid-v7">
      <div class="card"><span>📍</span><strong>${visited.length}</strong><small>places visited</small></div>
      <div class="card"><span>📸</span><strong>${t.memories.length}</strong><small>memories</small></div>
      <div class="card"><span>⭐</span><strong>${favorites.length}</strong><small>favorite moments</small></div>
      <div class="card"><span>🍜</span><strong>${meals}</strong><small>food entries</small></div>
      <div class="card"><span>💴</span><strong>${money(total)}</strong><small>tracked spending</small></div>
      <div class="card"><span>🗓️</span><strong>${t.itinerary.filter(x=>x.completed).length}</strong><small>activities done</small></div>
    </div>
    <div class="grid-2" style="margin-top:10px">
      <div class="card recap-feature-v7"><small>TOP SPENDING CATEGORY</small><strong>${topCat?`${expenseEmoji(topCat[0])} ${esc(topCat[0])}`:"—"}</strong><p>${topCat?money(topCat[1]):"No expenses yet"}</p></div>
      <div class="card recap-feature-v7"><small>BUSIEST PLANNED DAY</small><strong>${busiest?`${busiest.intensity.icon} Day ${dayNo(busiest.date,t)}`:"—"}</strong><p>${busiest?`${busiest.intensity.label} · ${money(busiest.spend)} spent`:"No itinerary yet"}</p></div>
    </div>
    ${favorites.length?`<section class="section"><div class="section-title"><h3>⭐ Favorite moments</h3></div><div class="grid-2">${favorites.slice(0,6).map(memoryCardV7).join("")}</div></section>`:""}
    <section class="section"><div class="notice-card success"><span class="notice-icon">📖</span><span><strong>Your trip stays on the Travel Shelf.</strong><p>Open Timeline, Food Diary, Highlights, Story Map and Scrapbook anytime after you come home.</p></span></div></section>`;
}
recapHTML = recapHTMLV7;

/* ---------- Travel calendar 2.0 ---------- */
function statsHTMLV7() {
  const s=personalTravelStatsV4(),trips=[...(state.trips||[])].map(ensureTripV7).sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const years=[...new Set(trips.map(x=>parseDate(x.startDate)?.getFullYear()).filter(Boolean))].sort();
  const monthNames=Array.from({length:12},(_,i)=>new Date(2026,i,1).toLocaleDateString(undefined,{month:"short"}));
  return `<div class="stats-grid-v4">
    <div class="card"><span>✈️</span><strong>${s.trips}</strong><small>Trips</small></div><div class="card"><span>🌏</span><strong>${s.destinations}</strong><small>Destinations</small></div><div class="card"><span>🗓️</span><strong>${s.days}</strong><small>Travel days</small></div><div class="card"><span>📍</span><strong>${s.visitedPlaces}</strong><small>Places visited</small></div><div class="card"><span>📸</span><strong>${s.memories}</strong><small>Memories</small></div><div class="card"><span>💴</span><strong>${s.totalExpenses?money(s.totalExpenses):"—"}</strong><small>Tracked spending*</small></div>
  </div><p class="inline-help">*Trips can use different currencies, so the combined spending figure is only directly comparable when their base currencies match.</p>
  <section class="section"><div class="section-title"><h3>🗓️ Travel Calendar 2.0</h3></div>${years.length?years.map(year=>`<div class="calendar-v7"><h3>${year}</h3><div class="calendar-month-grid-v7">${monthNames.map((m,idx)=>{const monthTrips=trips.filter(x=>parseDate(x.startDate)?.getFullYear()===year&&parseDate(x.startDate)?.getMonth()===idx);return`<div class="calendar-month-v7 ${monthTrips.length?"has-trip":""}"><strong>${m}</strong>${monthTrips.map(x=>`<button data-action="switch-trip" data-id="${x.id}" title="${esc(x.title)}">${esc(x.countryEmoji||"✈️")}<small>${parseDate(x.startDate).getDate()}</small></button>`).join("")}</div>`}).join("")}</div></div>`).join(""):empty("🗓️","No trips yet","Your travel years will collect here automatically.")}</section>`;
}
statsHTMLV4 = statsHTMLV7;

/* ---------- Storage manager 7.0 ---------- */
function formatBytesV7(bytes=0) {
  const n=Number(bytes||0);if(n<1024)return`${n} B`;if(n<1024**2)return`${(n/1024).toFixed(1)} KB`;if(n<1024**3)return`${(n/1024**2).toFixed(1)} MB`;return`${(n/1024**3).toFixed(2)} GB`;
}

function allReferencedFileKeysV7() {
  const keys=new Set();
  const walk=value=>{
    if(Array.isArray(value)){value.forEach(walk);return}
    if(!value||typeof value!=="object")return;
    Object.entries(value).forEach(([k,v])=>{
      if(/Key$/.test(k)&&typeof v==="string"&&v)keys.add(v);else walk(v);
    });
  };
  walk(state.trips);return keys;
}

function clearFileKeyReferencesV7(key,value=state.trips) {
  if(Array.isArray(value)){value.forEach(v=>clearFileKeyReferencesV7(key,v));return}
  if(!value||typeof value!=="object")return;
  Object.keys(value).forEach(k=>{
    const v=value[k];
    if(/Key$/.test(k)&&v===key)value[k]="";
    else clearFileKeyReferencesV7(key,v);
  });
}

function storageManagerHTMLV7() {
  return `<div class="section-title"><h3>💾 Storage Manager</h3><button data-action="cleanup-orphans-v7">Clean unused files</button></div>
    <div class="notice-card"><span class="notice-icon">📱</span><span><strong>Your media is local to this browser/app.</strong><p>Photos, receipts, tickets and documents are stored separately from the small trip records.</p></span></div>
    <div id="storageManagerBodyV7" class="storage-manager-v7"><div class="storage-loading-v7">Checking local storage…</div></div>`;
}

async function renderStorageManagerV7() {
  const host=document.querySelector("#storageManagerBodyV7");if(!host||!window.IchigoDB)return;
  try {
    const records=await IchigoDB.list(),estimate=await navigator.storage?.estimate?.().catch(()=>null),refs=allReferencedFileKeysV7();
    const total=records.reduce((s,r)=>s+Number(r.blob?.size||0),0),quota=Number(estimate?.quota||0),usage=Number(estimate?.usage||0);
    const byKind={};records.forEach(r=>{const k=r.kind||"other";byKind[k] ||= {count:0,bytes:0};byKind[k].count++;byKind[k].bytes+=Number(r.blob?.size||0)});
    host.innerHTML=`<div class="storage-top-v7">
      <div class="card"><small>ICHIGO MEDIA</small><strong>${formatBytesV7(total)}</strong><span>${records.length} files</span></div>
      <div class="card"><small>BROWSER USAGE</small><strong>${usage?formatBytesV7(usage):"—"}</strong><span>${quota?`${Math.round(usage/quota*100)}% of estimated quota`:"Quota unavailable"}</span></div>
      <div class="card"><small>UNUSED FILES</small><strong>${records.filter(r=>!refs.has(r.id)).length}</strong><span>safe cleanup candidates</span></div>
    </div>
    <div class="storage-kinds-v7">${Object.entries(byKind).sort((a,b)=>b[1].bytes-a[1].bytes).map(([k,v])=>`<div><span>${esc(k)}</span><strong>${formatBytesV7(v.bytes)}</strong><small>${v.count} file${v.count===1?"":"s"}</small></div>`).join("")}</div>
    <div class="storage-file-list-v7">${records.sort((a,b)=>Number(b.blob?.size||0)-Number(a.blob?.size||0)).map(r=>`<article><div><span>${r.mime?.startsWith("image/")?"🖼️":"📄"}</span><div><strong>${esc(r.name||"Local file")}</strong><small>${esc(r.kind||"other")} · ${formatBytesV7(r.blob?.size||0)} · ${refs.has(r.id)?"in use":"unused"}</small></div></div><button class="tiny-btn danger" data-action="delete-local-file-v7" data-key="${r.id}" data-name="${esc(r.name||"file")}">Delete</button></article>`).join("")||`<div class="empty"><div class="emoji">💾</div><h3>No local media yet</h3><p>Photos and attachments will appear here.</p></div>`}</div>`;
  } catch(error) {
    logErrorV7(error,"storage-manager");
    host.innerHTML=`<div class="notice-card danger"><span class="notice-icon">⚠️</span><span><strong>Storage couldn't be read.</strong><p>${esc(error.message||"IndexedDB error")}</p></span></div>`;
  }
}

async function cleanupOrphansV7() {
  const refs=allReferencedFileKeysV7(),records=await IchigoDB.list(),orphans=records.filter(r=>!refs.has(r.id));
  if(!orphans.length){notify("No unused local files found.");return}
  if(!confirm(`Delete ${orphans.length} unused local file${orphans.length===1?"":"s"}?`))return;
  for(const r of orphans)await IchigoDB.remove(r.id);
  renderStorageManagerV7();notify("Unused local files cleaned up.");
}

/* ---------- Offline Center ---------- */
function offlineCenterHTMLV7() {
  const prepared=state.settings.offlinePreparedAt;
  return `<div class="section-title"><h3>📴 Offline Center</h3><span class="badge ${navigator.onLine?"green":"gray"}">${navigator.onLine?"Online":"Offline"}</span></div>
    <div class="offline-grid-v7">
      <div class="card offline-ready-v7"><span>✅</span><div><strong>Trip records</strong><p>Itinerary, places, budgets, notes, tasks, phrases and settings are stored locally.</p></div></div>
      <div class="card offline-ready-v7"><span>✅</span><div><strong>Photos & documents</strong><p>IndexedDB attachments stay on this device unless browser storage is cleared.</p></div></div>
      <div class="card offline-conditional-v7"><span>🗺️</span><div><strong>Map backgrounds</strong><p>Coordinates stay local. OpenStreetMap tiles are cached opportunistically as you view them, but full areas are not guaranteed offline.</p></div></div>
      <div class="card offline-conditional-v7"><span>💱</span><div><strong>Live exchange rates</strong><p>Refreshing rates needs internet; your last saved/fallback rates remain usable.</p></div></div>
    </div>
    <div class="card offline-actions-v7"><h3>Prepare before you leave</h3><p>Open Ichigo online once, visit the screens you care about, and prepare the core shell. For maps, open the actual areas/zoom levels you expect to use.</p><div class="btn-row wrap-v3"><button class="btn primary" data-action="prepare-offline-v7">Prepare core offline</button><button class="btn soft" data-action="request-persistence-v7">Protect local storage</button><button class="btn" data-action="clear-map-cache-v7">Clear runtime map cache</button></div>${prepared?`<small>Last prepared: ${new Date(prepared).toLocaleString()}</small>`:""}</div>`;
}

async function prepareOfflineV7() {
  if(!navigator.onLine){notify("Reconnect first, then prepare the offline shell.");return}
  try{
    const urls=["./","./index.html","./style.css?v=20260811-build7","./app.js?v=20260811-build7","./data/data.js?v=20260811-build7","./data/db.js?v=20260811-build7","https://unpkg.com/leaflet@1.9.4/dist/leaflet.css","https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"];
    await Promise.allSettled(urls.map(u=>fetch(u,{cache:"reload"})));
    state.settings.offlinePreparedAt=new Date().toISOString();save();render();notify("Core offline resources refreshed ✓");
  }catch(error){logErrorV7(error,"prepare-offline");notify("Some offline resources couldn't be refreshed.")}
}

/* ---------- Release readiness ---------- */
function releaseHTMLV7() {
  return `<div class="section-title"><h3>🧪 Personal Release Check</h3><button data-action="run-release-check-v7">Run again</button></div>
    <div class="notice-card"><span class="notice-icon">🍓</span><span><strong>Personal-use readiness</strong><p>This checks local storage, IndexedDB, PWA registration, files and trip structure. It does not test Supabase because Ichigo does not use it yet.</p></span></div>
    <div id="releaseCheckBodyV7" class="release-check-v7"><div class="storage-loading-v7">Running checks…</div></div>`;
}

async function runReleaseSelfTestV7(showToast=true) {
  const host=document.querySelector("#releaseCheckBodyV7");
  const checks=[];
  const add=(name,pass,detail,warn=false)=>checks.push({name,pass,detail,warn});

  try{
    const key="ichigo-test-v7";localStorage.setItem(key,"ok");add("Structured data storage",localStorage.getItem(key)==="ok","localStorage read/write");localStorage.removeItem(key);
  }catch(e){add("Structured data storage",false,e.message)}

  try{
    await IchigoDB.open();const s=await IchigoDB.stats();add("Local media database",true,`${s.count} files · ${formatBytesV7(s.bytes)}`);
  }catch(e){add("Local media database",false,e.message)}

  try{
    const reg=await navigator.serviceWorker?.getRegistration?.();
    add("PWA service worker",!!reg,reg?`${reg.active?"active":"registered"} · ${navigator.serviceWorker.controller?"page controlled":"reload once to control"}`:"not registered",!!reg&&!navigator.serviceWorker.controller);
  }catch(e){add("PWA service worker",false,e.message)}

  try{
    const res=await fetch("./manifest.json",{cache:"no-store"});
    add("Web app manifest",res.ok,`HTTP ${res.status||"cached"}`);
  }catch(e){add("Web app manifest",false,"Unavailable offline or request failed",true)}

  const ids=[];
  state.trips.forEach(t=>["itinerary","places","bookings","packing","preTrip","expenses","memories","inbox"].forEach(k=>(t[k]||[]).forEach(x=>x.id&&ids.push(x.id))));
  const duplicates=ids.filter((x,i)=>ids.indexOf(x)!==i);
  add("Record IDs",duplicates.length===0,duplicates.length?`${new Set(duplicates).size} duplicate IDs found`:`${ids.length} IDs unique`);

  const invalidDates=state.trips.filter(t=>!parseDate(t.startDate)||!parseDate(t.endDate)||parseDate(t.startDate)>parseDate(t.endDate));
  add("Trip dates",!invalidDates.length,invalidDates.length?`${invalidDates.length} trip date range${invalidDates.length===1?"":"s"} need attention`:"Trip date ranges valid");

  const refs=allReferencedFileKeysV7();
  try{
    const records=await IchigoDB.list(),existing=new Set(records.map(x=>x.id)),missing=[...refs].filter(x=>!existing.has(x));
    add("Media references",!missing.length,missing.length?`${missing.length} referenced local file${missing.length===1?" is":"s are"} missing`:`${refs.size} referenced file keys resolved`,!!missing.length);
  }catch(e){add("Media references",false,e.message,true)}

  const stateBytes=new Blob([JSON.stringify(state)]).size;
  add("Structured data size",stateBytes<4_000_000,`${formatBytesV7(stateBytes)} in localStorage`,stateBytes>=3_000_000);

  const errors=JSON.parse(sessionStorage.getItem(ERROR_LOG_V7)||"[]");
  add("Current-session errors",errors.length===0,errors.length?`${errors.length} captured error${errors.length===1?"":"s"} this session`:"No captured runtime errors",errors.length>0);

  const passed=checks.filter(x=>x.pass).length;
  if(host)host.innerHTML=`<div class="release-score-v7"><strong>${passed}/${checks.length}</strong><span>${passed===checks.length?"Ready for personal testing ✨":"Review the items below"}</span></div><div class="release-list-v7">${checks.map(c=>`<div class="${c.pass?(c.warn?"warn":"pass"):"fail"}"><span>${c.pass?(c.warn?"⚠️":"✓"):"✕"}</span><div><strong>${esc(c.name)}</strong><small>${esc(c.detail)}</small></div></div>`).join("")}</div><div class="release-foot-v7"><strong>Build ${APP_VERSION_V7}</strong><span>Schema ${APP_SCHEMA_VERSION_V7} · ${navigator.onLine?"Online":"Offline"}</span></div>`;
  if(showToast)notify(`${passed}/${checks.length} personal release checks passed`);
  return{passed,total:checks.length,checks};
}

/* ---------- App tour ---------- */
function openTourV7() {
  state.onboarding.build7Seen=true;save();
  openModal("What's in Ichigo now",`<div class="tour-v7">
    <div><span>🍓</span><h3>Smart Planner</h3><p>Select saved places and build a locally suggested day. Route estimates are helpers, not live transit.</p></div>
    <div><span>📝</span><h3>Notes + Inbox</h3><p>Scratch ideas quickly, then convert them into real trip items later.</p></div>
    <div><span>📖</span><h3>Your trip becomes a story</h3><p>Timeline, Food Diary, Highlights, Story Map and Scrapbook fill themselves from your data.</p></div>
    <div><span>📴</span><h3>Local-first</h3><p>Core trip data and attachments stay on your device. Maps and fresh exchange rates still benefit from internet.</p></div>
    <div><span>💾</span><h3>Back up before important trips</h3><p>Use full backup or per-trip export. Browser storage is convenient, but it should not be your only copy of precious travel memories.</p></div>
  </div>`);
}

/* ---------- Trip navigation 6 + 7 ---------- */
const tripHTMLBeforeV7 = tripHTML;
tripHTML = function tripHTMLV7(v) {
  if(v==="timeline")return timelineHTMLV7();
  if(v==="food")return foodDiaryHTMLV7();
  if(v==="highlights")return highlightsHTMLV7();
  if(v==="visited")return visitedMapHTMLV7();
  if(v==="offline")return offlineCenterHTMLV7();
  if(v==="storage")return storageManagerHTMLV7();
  if(v==="release")return releaseHTMLV7();
  return tripHTMLBeforeV7(v);
};

renderTrip = function renderTripV7() {
  const menu=[
    ["memories","📸","Journal"],["timeline","🕰️","Timeline"],["food","🍜","Food Diary"],["highlights","⭐","Highlights"],
    ["visited","🗺️","Story Map"],["scrapbook","📖","Scrapbook"],["recap","📊","Recap"],["health","💗","Health"],
    ["stats","🌏","Stats"],["offline","📴","Offline"],["storage","💾","Storage"],["info","ℹ️","Trip Info"],
    ["settings","⚙️","Settings"],["release","🧪","Release Check"]
  ];
  main.innerHTML=`<div class="page-head"><div><p class="eyebrow">TRIP</p><h1>${esc(trip().title)}</h1><p>Plan it · live it · remember it</p></div></div><div class="chips">${menu.map(([k,e,l])=>`<button class="chip ${state.tripView===k?"active":""}" data-action="set-trip-view" data-feature="${k}">${e} ${l}</button>`).join("")}</div><section class="section">${tripHTML(state.tripView)}</section>`;
};

/* Upgrade settings without discarding Build 4 controls. */
const settingsHTMLBeforeV7 = settingsHTML;
settingsHTML = function settingsHTMLV7() {
  return `${settingsHTMLBeforeV7()}
    ${aboutIchigoCardV74()}
    <section class="card settings-card-v3 about-version-card-v74">
      <div class="section-title"><h3>🌸 About & updates</h3><span class="badge gray">v${esc(ICHIGO_CURRENT_VERSION)}</span></div>
      <p class="meta">Ichigo will show an update banner when a newer GitHub Pages build is waiting to be installed.</p>
      <div class="btn-row wrap-v3"><button class="btn soft" data-action="show-whats-new-v74">What’s New</button><button class="btn" data-action="force-update-check-v3">Check for update</button></div>
    </section>
    <section class="card settings-card-v3"><div class="section-title"><h3>🍓 Personal tools</h3></div><div class="btn-row wrap-v3"><button class="btn soft" data-action="open-tour-v7">App tour</button><button class="btn" data-action="customize-dashboard-v7">Dashboard</button><button class="btn" data-action="open-offline-v7">Offline Center</button><button class="btn" data-action="open-storage-v7">Storage Manager</button><button class="btn" data-action="open-release-v7">Release Check</button></div></section>`;
};

/* ---------- Search now includes notes ---------- */
const searchIndexBeforeV7 = searchIndexV3;
searchIndexV3 = function searchIndexNotesV7(query) {
  const rows=searchIndexBeforeV7(query),q=String(query||"").trim().toLowerCase(),t=trip();
  if(!q)return rows;
  if(String(t.tripNotes||"").toLowerCase().includes(q))rows.push({kind:"tripnote",id:"trip-notes",title:"Trip Notes",detail:"Trip notebook"});
  t.quickNotes.forEach(n=>{if(n.text.toLowerCase().includes(q))rows.push({kind:"scratch",id:n.id,title:n.text,detail:"Scratchpad"})});
  return rows.slice(0,70);
};

const goToSearchBeforeV7 = goToSearchResultV3;
goToSearchResultV3 = function goToSearchResultNotesV7(kind) {
  if(kind==="tripnote"||kind==="scratch"){
    state.currentView="plan";state.planView="notes";save();closeModal();render();return;
  }
  return goToSearchBeforeV7(kind);
};

/* ---------- Build 5/6/7 actions ---------- */
document.addEventListener("click",async event=>{
  const el=event.target.closest("[data-action]");if(!el)return;
  const a=el.dataset.action,t=trip();

  if(a==="undo-v7")undoV7();
  if(a==="open-plan-day-v7")planMyDayModalV7(el.dataset.date||state.activeItineraryDate||activeDate());
  if(a==="add-place-day-v7")addPlaceToDayV7(el.dataset.placeId,el.dataset.date||activeDate());
  if(a==="optimize-route-v7")optimizeRouteV7(el.dataset.date||activeDate());
  if(a==="push-later-v7")pushLaterModalV7(el.dataset.id);
  if(a==="edit-day-budgets-v7")dayBudgetModalV7();

  if(a==="toggle-favorite-v7"){
    const kind=el.dataset.kind,id=el.dataset.id;
    const item=kind==="place"?t.places.find(x=>x.id===id):kind==="activity"?t.itinerary.find(x=>x.id===id):t.memories.find(x=>x.id===id);
    if(item){item.favorite=!item.favorite;if(kind==="memory")item.highlight=item.favorite;markChangedV7(`${item.favorite?"Favorited":"Unfavorited"} ${item.name||item.title||"item"}`,kind,id);render()}
  }

  if(a==="convert-inbox-v7")convertInboxV7(el.dataset.id,el.dataset.target);
  if(a==="pin-scratch-v7"){const n=t.quickNotes.find(x=>x.id===el.dataset.id);if(n){n.pinned=!n.pinned;save();render()}}
  if(a==="delete-scratch-v7"){if(confirm("Delete this scratch note?")){t.quickNotes=t.quickNotes.filter(x=>x.id!==el.dataset.id);save();render()}}
  if(a==="scratch-to-inbox-v7"){const n=t.quickNotes.find(x=>x.id===el.dataset.id);if(n){t.inbox.push({id:uuid(),type:"Note",title:n.text.slice(0,80),note:n.text,url:"",fileKey:"",status:"inbox",createdAt:Date.now()});t.quickNotes=t.quickNotes.filter(x=>x.id!==n.id);markChangedV7("Moved scratch note to Inbox","inbox");render()}}

  if(a==="memory-filter-v7"){state.memoryFilter=el.dataset.filter;save();render()}
  if(a==="story-date-v7"){state.storyDate=el.dataset.date;save();render()}
  if(a==="prompt-memory-v7")openModal("Journal Prompt",memoryFormHTMLV2({prompt:el.dataset.prompt||randomJournalPromptV7(),date:activeDate()}));

  if(a==="customize-dashboard-v7")dashboardCustomizeModalV7();
  if(a==="set-plan-view-home-v7"){state.currentView="plan";state.planView=el.dataset.feature;save();render()}
  if(a==="set-spend-view-home-v7"){state.currentView="spend";state.spendView=el.dataset.feature;save();render()}
  if(a==="go-today-v7"){state.currentView="today";save();render()}

  if(a==="open-offline-v7"){state.currentView="trip";state.tripView="offline";save();render()}
  if(a==="open-storage-v7"){state.currentView="trip";state.tripView="storage";save();render()}
  if(a==="open-release-v7"){state.currentView="trip";state.tripView="release";save();render()}
  if(a==="open-tour-v7")openTourV7();
  if(a==="recovery-home-v7"){state.currentView="home";save();render()}

  if(a==="prepare-offline-v7")await prepareOfflineV7();
  if(a==="request-persistence-v7"){
    if(!navigator.storage?.persist){notify("Persistent-storage requests aren't supported by this browser.");return}
    const ok=await navigator.storage.persist().catch(()=>false);
    notify(ok?"Browser granted persistent storage ✓":"The browser kept its normal storage policy.");
  }
  if(a==="clear-map-cache-v7"){
    navigator.serviceWorker?.controller?.postMessage({type:"CLEAR_RUNTIME"});
    notify("Runtime map/library cache clear requested.");
  }

  if(a==="delete-local-file-v7"){
    const key=el.dataset.key,name=el.dataset.name||"file";
    if(confirm(`Delete ${name} from local storage? Any Ichigo reference to this file will also be cleared.`)){
      await IchigoDB.remove(key);clearFileKeyReferencesV7(key);save();renderStorageManagerV7();notify("Local file deleted");
    }
  }
  if(a==="cleanup-orphans-v7")await cleanupOrphansV7();
  if(a==="run-release-check-v7")await runReleaseSelfTestV7(true);
});

/* ---------- Build 5/6/7 forms ---------- */
document.addEventListener("submit",async event=>{
  const f=event.target;
  if(!["activityFormV7","placeFormV7","memoryFormV7","planMyDayFormV7","pushLaterFormV7","dayBudgetsFormV7","tripNotesFormV7","scratchpadFormV7","dashboardFormV7"].includes(f.id))return;
  event.preventDefault();
  const fd=new FormData(f),d=Object.fromEntries(fd.entries()),t=trip();

  if(f.id==="activityFormV7"){
    const editId=f.dataset.editId||"",old=editId?t.itinerary.find(x=>x.id===editId):null,oldDate=old?.date,item=old||{id:uuid(),order:activitiesOn(d.date,t).length,completed:false,skipped:false};
    if(old)pushUndoV7("activity edit");
    const flexible=d.daypart!=="Fixed";
    Object.assign(item,{date:d.date,time:flexible?(d.time||""):(d.time||""),daypart:d.daypart||"Fixed",duration:Number(d.duration||60),travelTime:Number(d.travelTime||0),estimatedCost:Number(d.estimatedCost||0),type:d.type,title:d.title.trim(),place:d.place.trim(),address:d.address.trim(),notes:d.notes.trim(),flexible,favorite:!!d.favorite,sourcePlaceId:d.sourcePlaceId||"",lat:d.lat?Number(d.lat):null,lng:d.lng?Number(d.lng):null});
    if(!old)t.itinerary.push(item);
    if(oldDate&&oldDate!==d.date){renumberDay(oldDate,t);item.order=activitiesOn(d.date,t).length}
    renumberDay(d.date,t);state.activeItineraryDate=d.date;markChangedV7(`${old?"Updated":"Added"} activity: ${item.title}`,"activity",item.id);closeModal();state.currentView="plan";state.planView="itinerary";render();
  }

  if(f.id==="placeFormV7"){
    const editId=f.dataset.editId||"",old=editId?t.places.find(x=>x.id===editId):null,item=old||{id:uuid(),votes:{},visited:false};
    Object.assign(item,{name:d.name.trim(),area:d.area.trim(),category:d.category,priority:d.priority,favorite:!!d.favorite,openingHours:d.openingHours.trim(),estimatedDuration:Number(d.estimatedDuration||90),estimatedCost:Number(d.estimatedCost||0),address:d.address.trim(),lat:d.lat?Number(d.lat):null,lng:d.lng?Number(d.lng):null,mapUrl:d.mapUrl.trim(),reservationUrl:d.reservationUrl.trim(),tags:d.tags.split(",").map(x=>x.trim()).filter(Boolean),notes:d.notes.trim()});
    if(!old)t.places.push(item);markChangedV7(`${old?"Updated":"Saved"} place: ${item.name}`,"place",item.id);closeModal();state.currentView="plan";state.planView="places";render();
  }

  if(f.id==="memoryFormV7"){
    const editId=f.dataset.editId||"",old=editId?t.memories.find(x=>x.id===editId):null,item=old||{id:uuid(),photoKey:""};
    const photo=f.querySelector('[name="photo"]');
    if(photo?.files?.[0]){try{const blob=await IchigoDB.compressImage(photo.files[0],1600,.8);if(item.photoKey)await IchigoDB.remove(item.photoKey);item.photoKey=await IchigoDB.put(blob,{name:photo.files[0].name,kind:"memory"})}catch(error){logErrorV7(error,"memory-photo");notify("Photo couldn't be saved, but the journal note will be kept.")}}
    Object.assign(item,{date:d.date,time:d.time||"",title:d.title.trim(),note:d.note.trim(),location:d.location.trim(),lat:d.lat?Number(d.lat):null,lng:d.lng?Number(d.lng):null,memoryType:d.memoryType||"Moment",prompt:d.prompt||"",favorite:!!d.favorite,highlight:!!d.favorite});
    if(!old)t.memories.push(item);markChangedV7(`${old?"Updated":"Saved"} memory: ${item.title||item.memoryType}`,"memory",item.id);closeModal();state.currentView="trip";state.tripView="memories";render();
  }

  if(f.id==="planMyDayFormV7"){
    const placeIds=fd.getAll("placeIds"),ok=buildDayFromPlacesV7({date:d.date,startTime:d.startTime||"09:00",pace:d.pace||"comfortable",replaceDay:!!d.replaceDay,placeIds});
    if(ok){closeModal();state.currentView="plan";state.planView="itinerary";render();notify("Your smart day is ready 🍓")}
  }

  if(f.id==="pushLaterFormV7"){applyPushLaterV7(f.dataset.id,Number(d.minutes||15));closeModal();render();notify("Later activities shifted")}

  if(f.id==="dayBudgetsFormV7"){
    allDates(t).forEach(date=>t.dayBudgets[date]=Number(d[`day_${date}`]||0));markChangedV7("Updated daily budgets","budget");closeModal();render();notify("Day budgets saved");
  }

  if(f.id==="tripNotesFormV7"){t.tripNotes=d.notes.trim();markChangedV7("Updated Trip Notes","note");render();notify("Trip Notes saved")}

  if(f.id==="scratchpadFormV7"){t.quickNotes.push({id:uuid(),text:d.text.trim(),pinned:false,createdAt:Date.now()});markChangedV7("Added scratch note","note");f.reset();render()}

  if(f.id==="dashboardFormV7"){state.settings.dashboardWidgets=fd.getAll("widgets");save();closeModal();render();notify("Dashboard updated")}
});

/* ---------- Recently changed: observe common existing edits ---------- */
const recentActionLabelsV7={
  "complete-activity-v3":"Changed activity completion",
  "arrived-v3":"Marked arrival",
  "archive-inbox-v3":"Changed Inbox status",
  "toggle-pack":"Updated packing",
  "toggle-task":"Updated Before You Go",
  "mark-visited":"Updated visited place"
};
document.addEventListener("click",event=>{
  const el=event.target.closest("[data-action]"),label=recentActionLabelsV7[el?.dataset.action];
  if(!label)return;
  setTimeout(()=>{try{markChangedV7(label,el.dataset.action,el.dataset.id||"")}catch{}},120);
});


/* =====================================================================
   ICHIGO BUILD 7.1 — CLEAN FIRST-RUN / NO SEEDED CONTENT
   - Zero trips on a brand-new install
   - Zero travelers on a newly created trip
   - No named people, sample places, sample bookings or sample expenses
   - Removes the legacy Japan 2026 demo from older prototype installs
   ===================================================================== */

const APP_VERSION_V71 = "7.4.0-personal-about-updates";
const CACHE_VERSION_V71 = "ichigo-build7-4-about-updates-v1";

function isLegacyDemoTripV71(t) {
  if (!t) return false;
  const names = new Set((t.travelers || []).map(x => String(x.name || "").trim().toLowerCase()));
  const placeNames = new Set((t.places || []).map(x => String(x.name || "").trim().toLowerCase()));
  const legacyPeople = names.has("cha") && names.has("martin");
  const legacyPlaces =
    placeNames.has("ichiran ramen") &&
    placeNames.has("teamlab planets") &&
    placeNames.has("shibuya sky");
  return t.title === "Japan 2026" && t.destination === "Japan" && legacyPeople && legacyPlaces;
}

function cleanLegacyDemoV71() {
  let removed = false;
  state.trips = (state.trips || []).filter(t => {
    if (isLegacyDemoTripV71(t)) { removed = true; return false; }
    return true;
  });

  if (removed) {
    state.currentTripId = state.trips[0]?.id || "";
    state.currentView = "home";
    state.planView = "itinerary";
    state.spendView = "budget";
    state.tripView = "memories";

    /* The original prototype also injected Philippines / Me defaults.
       Only neutralize them as part of this known legacy-demo cleanup. */
    state.settings ||= {};
    if (state.settings.travelerName === "Me") state.settings.travelerName = "";
    if (state.settings.homeCountry === "Philippines") state.settings.homeCountry = "";
    if (state.settings.homeCurrency === "PHP") state.settings.homeCurrency = "USD";
    if (state.settings.defaultTripCurrency === "JPY") state.settings.defaultTripCurrency = "USD";
  }
  return removed;
}

function renderFreshStartV71() {
  document.documentElement.dataset.theme = state.settings?.theme || "strawberry";
  document.body.classList.add("fresh-mode-v72");

  main.innerHTML = `
    <section class="fresh-start-v71">
      <div class="fresh-berry-v71">
        <img src="./icons/icon-192-v41.png" alt="Ichigo">
      </div>
      <p class="eyebrow">WELCOME TO ICHIGO</p>
      <h1>Plan sweet little adventures.</h1>
      <p class="fresh-copy-v71">Create your first trip and start building your itinerary, places, budget, bookings and travel memories.</p>

      <div class="fresh-actions-v71 fresh-actions-v73">
        <button class="btn primary" data-action="new-trip">＋ Create your first trip</button>
        <button class="btn soft" data-action="explore-ichigo-v73">Explore Ichigo →</button>
      </div>

      <div class="fresh-features-v71">
        <div><span>🗓️</span><strong>Plan</strong><small>Itinerary, places, bookings and packing</small></div>
        <div><span>🍓</span><strong>Live it</strong><small>Today Mode, spending and quick notes</small></div>
        <div><span>📖</span><strong>Remember</strong><small>Journal, timeline and scrapbook</small></div>
      </div>

      ${aboutIchigoCardV74(true)}
    </section>`;
  updateOnline();
}

const renderBeforeFreshV71 = render;
render = function renderWithFreshStartV71() {
  ensureStateV7();
  if (!(state.trips || []).length) {
    renderFreshStartV71();
    return;
  }
  document.body.classList.remove("fresh-mode-v72");
  renderBeforeFreshV71();
};

/* Travel Together must look intentionally empty until the user adds people. */
renderTogether = function renderTogetherFreshV71() {
  const t=trip();
  const travelers=t.travelers||[];
  const matches=travelers.length
    ? t.places.filter(p=>{
        const votes=p.votes||{};
        return travelers.every(person=>["❤️","👍"].includes(votes[person.id]));
      })
    : [];

  main.innerHTML=`
    <div class="page-head">
      <div><p class="eyebrow">TOGETHER</p><h1>Travel Together</h1><p>Add the people joining this trip</p></div>
      <button class="btn soft" data-action="add-traveler-v3">＋ Traveler</button>
    </div>

    <section class="section">
      <div class="section-title"><h3>Travelers</h3><span class="meta">${travelers.length}</span></div>
      ${travelers.length
        ? `<div class="card" style="padding:8px 13px">${travelers.map(x=>`
            <div class="list-row" style="border:0">
              <div class="row-icon">${x.emoji||"🙂"}</div>
              <div class="row-main"><h4>${esc(x.name)}</h4><p>${esc(x.role||"Member")}</p></div>
              <button class="tiny-btn" data-action="edit-traveler-v3" data-id="${x.id}">Edit</button>
              <button class="tiny-btn danger" data-action="delete-traveler-v3" data-id="${x.id}">Delete</button>
            </div>`).join("")}</div>`
        : empty("👥","No travelers added","Add yourself, a partner, family member or friend only if you want to use the local Together tools.")}
    </section>

    <section class="section">
      <div class="section-title"><h3>💗 Group Picks</h3><span class="meta">${matches.length} matches</span></div>
      <div class="list">${matches.length
        ? matches.map(p=>`<div class="list-row"><div class="row-icon">${categoryEmoji(p.category)}</div><div class="row-main"><h4>${esc(p.name)}</h4><p>${esc(p.area)} · everyone is interested</p></div><span>💗</span></div>`).join("")
        : empty("💗","No group picks yet",travelers.length<2?"Add at least two travelers, then vote on saved places.":"Vote on saved places to discover shared favorites.")}</div>
    </section>

    <section class="section">${travelers.length?splitHTML():`<div class="notice-card"><span class="notice-icon">💸</span><span><strong>Shared expenses are optional.</strong><p>Add travelers first if you want Ichigo to calculate local expense splits.</p></span></div>`}</section>`;
};

/* Traveler form uses a friendly neutral face only as a visual fallback. */
travelerFormHTMLV3 = function travelerFormFreshV71(item={}) {
  return `<form id="travelerFormV3" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row"><label>NAME</label><input name="name" required value="${esc(item.name||"")}" placeholder="Traveler name"></div>
    <div class="form-row two">
      <div><label>EMOJI</label><input name="emoji" value="${esc(item.emoji||"🙂")}" placeholder="🙂"></div>
      <div><label>ROLE</label><select name="role"><option ${item.role==="Owner"?"selected":""}>Owner</option><option ${item.role!=="Owner"?"selected":""}>Member</option></select></div>
    </div>
    <button class="btn primary">Save traveler</button>
  </form>`;
};

/* Make the newest trip forms blank with zero travelers. */
const createTripFromTemplateBeforeV71 = createTripFromTemplateV4;
createTripFromTemplateV4 = function createTripFromTemplateFreshV71(templateId,data) {
  const created=createTripFromTemplateBeforeV71(templateId,data);
  created.travelers=[];
  save();
  return created;
};



/* =====================================================================
   ICHIGO BUILD 7.3 — EXPLORE BEFORE CREATING A TRIP
   A brand-new user can browse empty feature previews without generating
   any fake trip, traveler, expense, place, booking or other sample data.
   ===================================================================== */

let exploreModeV73 = false;

function exploreFeatureCardV73(icon,title,detail) {
  return `<article class="explore-feature-card-v73"><span>${icon}</span><div><strong>${esc(title)}</strong><p>${esc(detail)}</p></div></article>`;
}

function exploreCTAHeaderV73(kicker,title,copy) {
  return `<div class="explore-page-head-v73">
    <div>
      <p class="eyebrow">${esc(kicker)}</p>
      <h1>${esc(title)}</h1>
      <p>${esc(copy)}</p>
    </div>
    <button class="btn primary" data-action="new-trip">＋ Create Trip</button>
  </div>`;
}

function renderExploreHomeV73() {
  main.innerHTML = `
    <section class="explore-home-v73">
      <div class="explore-welcome-v73">
        <img src="./icons/icon-192-v41.png" alt="">
        <div>
          <p class="eyebrow">EXPLORE ICHIGO</p>
          <h1>Take a look around. 🍓</h1>
          <p>Nothing here is sample trip data. These are just previews of what Ichigo can do once you create your own trip.</p>
        </div>
      </div>

      <div class="explore-start-actions-v73">
        <button class="btn primary" data-action="new-trip">＋ Create your first trip</button>
        <button class="btn soft" data-action="leave-explore-v73">← Back to welcome</button>
      </div>

      <section class="section">
        <div class="section-title"><h3>What you can use</h3><span class="meta">tap the tabs below to explore</span></div>
        <div class="explore-grid-v73">
          ${exploreFeatureCardV73("🗓️","Plan","Itinerary, saved places, smart day planning, bookings, packing and travel essentials.")}
          ${exploreFeatureCardV73("🍓","Today","A focused travel-day screen for your next activity, quick expenses, notes and memories.")}
          ${exploreFeatureCardV73("💴","Spend","Budgets, daily budgets, expenses, analytics, converter and expense splits.")}
          ${exploreFeatureCardV73("👥","Together","Optional local traveler list, group picks and shared-expense calculations.")}
          ${exploreFeatureCardV73("📖","Remember","Journal, timeline, food diary, highlights, story map, scrapbook and recap.")}
          ${exploreFeatureCardV73("📴","Offline","Local storage, backups, document vault, storage manager and release checks.")}
        </div>
      </section>

      ${aboutIchigoCardV74()}
      <div class="explore-note-v73">Explore mode does not create a trip or add any content to your Ichigo.</div>
    </section>`;
}

function renderExplorePlanV73() {
  main.innerHTML = `
    ${exploreCTAHeaderV73("PLAN","Plan your trip","This is where your trip takes shape—from loose ideas to a day-by-day itinerary.")}
    <div class="explore-section-list-v73">
      ${exploreFeatureCardV73("🗓️","Itinerary","Build days with fixed times or flexible Morning, Afternoon, Evening and Anytime activities.")}
      ${exploreFeatureCardV73("🍓","Smart Planner","Choose saved places and let Ichigo suggest a local route order using the information you entered.")}
      ${exploreFeatureCardV73("📍","Places","Save restaurants, cafés, shops and attractions with priorities, coordinates, hours and expected cost.")}
      ${exploreFeatureCardV73("📥","Inbox & Scratchpad","Capture random recommendations first and organize them later.")}
      ${exploreFeatureCardV73("🎟️","Bookings","Keep flights, hotels, reservations, confirmations and offline attachments together.")}
      ${exploreFeatureCardV73("🧳","Packing","Reusable packing lists and templates.")}
      ${exploreFeatureCardV73("✅","Before You Go","Visa, insurance, documents, SIM, money and other pre-trip tasks.")}
      ${exploreFeatureCardV73("🔐","Offline Essentials","Hotel details, contacts, phrases and your local document vault.")}
    </div>`;
}

function renderExploreTodayV73() {
  main.innerHTML = `
    ${exploreCTAHeaderV73("TODAY","Your travel day, simplified","Today Mode becomes the one-handed screen you use while you're actually out exploring.")}
    <div class="explore-phone-card-v73">
      <div class="badge green">NEXT</div>
      <p class="eyebrow">YOUR DESTINATION · DAY 1</p>
      <h2>Your next activity</h2>
      <p>Time · place · travel note</p>
      <div class="explore-action-row-v73"><span>📍 I'm here</span><span>✓ Done</span><span>+15m</span><span>🗺 Map</span></div>
    </div>
    <div class="explore-grid-v73">
      ${exploreFeatureCardV73("⏰","Live timeline","Current, next and overdue activities based on your itinerary.")}
      ${exploreFeatureCardV73("💸","Quick expense","Log spending without digging through menus.")}
      ${exploreFeatureCardV73("📝","Quick notes","Attach notes to what you're doing right now.")}
      ${exploreFeatureCardV73("📸","Instant memories","Turn an activity into a journal memory while it's fresh.")}
    </div>`;
}

function renderExploreSpendV73() {
  main.innerHTML = `
    ${exploreCTAHeaderV73("SPEND","Keep the trip budget visible","Plan a budget before you leave and compare it with what you actually spend.")}
    <div class="explore-money-v73">
      <div><small>TRIP BUDGET</small><strong>—</strong><span>Set your own amount</span></div>
      <div><small>TODAY</small><strong>—</strong><span>Daily budget tracking</span></div>
      <div><small>FORECAST</small><strong>—</strong><span>Based on your real expenses</span></div>
    </div>
    <div class="explore-grid-v73">
      ${exploreFeatureCardV73("💰","Budget","Overall, category and individual day budgets.")}
      ${exploreFeatureCardV73("🧾","Expenses","Merchant, category, payment method, receipts and notes.")}
      ${exploreFeatureCardV73("📈","Analytics","Daily trends, biggest expense, payment breakdown and spending forecast.")}
      ${exploreFeatureCardV73("💱","Converter","Calculator-style currency conversion with saved offline fallback rates.")}
    </div>`;
}

function renderExploreTogetherV73() {
  main.innerHTML = `
    ${exploreCTAHeaderV73("TOGETHER","Optional shared planning tools","You decide who to add. Ichigo starts with zero travelers.")}
    <div class="explore-empty-card-v73">
      <span>👥</span>
      <h2>No travelers by default</h2>
      <p>When you create a trip, you can keep it entirely solo or manually add the people traveling with you.</p>
    </div>
    <div class="explore-grid-v73">
      ${exploreFeatureCardV73("💗","Group Picks","Vote on saved places and see what everyone is interested in.")}
      ${exploreFeatureCardV73("💸","Expense Splits","Track who paid and calculate what each traveler owes.")}
      ${exploreFeatureCardV73("📱","Local for now","Until Supabase is added later, Together tools remain on this device.")}
    </div>`;
}

function renderExploreTripV73() {
  main.innerHTML = `
    ${exploreCTAHeaderV73("TRIP","The trip becomes your story","After planning and traveling, Ichigo turns the same information into something worth keeping.")}
    <div class="explore-grid-v73">
      ${exploreFeatureCardV73("📸","Journal","Photos, tiny notes, locations and favorite moments.")}
      ${exploreFeatureCardV73("🕰️","Timeline","Itinerary + expenses + memories combined chronologically.")}
      ${exploreFeatureCardV73("🍜","Food Diary","Food expenses and food memories gathered automatically.")}
      ${exploreFeatureCardV73("⭐","Highlights","Favorite places, activities and memories in one view.")}
      ${exploreFeatureCardV73("🗺️","Story Map","Visited places and mapped memories.")}
      ${exploreFeatureCardV73("📖","Scrapbook","Automatic day-by-day travel pages built from your own data.")}
      ${exploreFeatureCardV73("📊","Recap","Trip statistics, spending, favorites and completed activities.")}
      ${exploreFeatureCardV73("💾","Storage & Backup","Local media manager, per-trip export and full backup.")}
    </div>`;
}

function renderExploreV73() {
  document.body.classList.remove("fresh-mode-v72");
  document.body.classList.add("explore-mode-v73");

  document.querySelectorAll(".nav-item").forEach(x => {
    const active=x.dataset.nav===state.currentView;
    x.classList.toggle("active",active);
    if(active)x.setAttribute("aria-current","page");else x.removeAttribute("aria-current");
  });

  ({
    home:renderExploreHomeV73,
    plan:renderExplorePlanV73,
    today:renderExploreTodayV73,
    spend:renderExploreSpendV73,
    together:renderExploreTogetherV73,
    trip:renderExploreTripV73
  }[state.currentView] || renderExploreHomeV73)();

  updateOnline();
}

const renderFreshAwareBeforeV73 = render;
render = function renderExploreAwareV73() {
  ensureStateV7();

  if (!(state.trips || []).length) {
    if (exploreModeV73) {
      renderExploreV73();
      return;
    }
    document.body.classList.remove("explore-mode-v73");
    renderFreshStartV71();
    return;
  }

  exploreModeV73=false;
  document.body.classList.remove("explore-mode-v73");
  renderFreshAwareBeforeV73();
};

document.addEventListener("click",event=>{
  const el=event.target.closest("[data-action]");
  if(!el)return;

  if(el.dataset.action==="explore-ichigo-v73"){
    exploreModeV73=true;
    state.currentView="home";
    save();
    render();
  }

  if(el.dataset.action==="leave-explore-v73"){
    exploreModeV73=false;
    state.currentView="home";
    save();
    render();
  }

  if(el.dataset.action==="show-whats-new-v74"){
    showWhatsNewV74(true);
  }

  if(el.dataset.action==="dismiss-whats-new-v74"){
    localStorage.setItem("ichigo-last-seen-app-version",ICHIGO_CURRENT_VERSION);
    closeModal();
  }
});



/* =====================================================================
   ICHIGO BUILD 7.4 — ABOUT ICHIGO + SAKURA-STYLE UPDATES
   ===================================================================== */

const ICHIGO_ABOUT_V74 = `Ichigo (いちご) means “strawberry.” Bright, sweet, and playful, Ichigo is made for collecting all the little plans and memories that make a trip something to look forward to.`;

const ICHIGO_WHATS_NEW_V74 = {
  version: "8.0.0",
  title: "What’s New in Ichigo",
  items: [
    "A cleaner hamburger navigation now keeps the bottom bar focused on the essentials.",
    "Added Travel Lists, Day Board, Reservation Board, Checklist Center and Time Zone Board.",
    "Navigation, Quick Add, layout density and motion are now customizable.",
    "Home and major sections were simplified for smoother everyday use.",
    "Stability, offline caching and first-time empty states received a large cleanup."
  ]
};

function aboutIchigoCardV74(compact=false) {
  return `<section class="about-ichigo-v74 ${compact?"compact":""}">
    <img src="./icons/icon-192-v41.png" alt="">
    <div>
      <p class="eyebrow">ABOUT ICHIGO</p>
      <h3>Why Ichigo? 🍓</h3>
      <p>${esc(ICHIGO_ABOUT_V74)}</p>
    </div>
  </section>`;
}

function whatsNewHTMLV74() {
  return `<div class="whats-new-v74">
    <div class="whats-new-icon-v74"><img src="./icons/icon-192-v41.png" alt=""></div>
    <p class="eyebrow">ICHIGO UPDATED</p>
    <h2>${esc(ICHIGO_WHATS_NEW_V74.title)}</h2>
    <p class="whats-new-version-v74">${esc(ICHIGO_CURRENT_VERSION)}</p>
    <div class="whats-new-list-v74">
      ${ICHIGO_WHATS_NEW_V74.items.map(x=>`<div><span>🍓</span><p>${esc(x)}</p></div>`).join("")}
    </div>
    <button class="btn primary full" data-action="dismiss-whats-new-v74">Got it</button>
  </div>`;
}

function showWhatsNewV74(force=false) {
  const seen=localStorage.getItem("ichigo-last-seen-app-version");
  if(!force && (!seen || seen===ICHIGO_CURRENT_VERSION)) {
    localStorage.setItem("ichigo-last-seen-app-version",ICHIGO_CURRENT_VERSION);
    return;
  }
  localStorage.setItem("ichigo-last-seen-app-version",ICHIGO_CURRENT_VERSION);
  if(modalRoot?.firstElementChild)return;
  openModal("Ichigo updated",whatsNewHTMLV74());
}



/* =====================================================================
   ICHIGO 8 — MEGA PERSONAL TRAVEL APP
   Production-minded local-first release. No Supabase, no demo content.

   NAVIGATION / UX
   • Clean hamburger navigation grouped by task
   • Only important destinations stay in the bottom bar
   • User-customizable bottom tabs and quick-add actions
   • Pinned drawer favorites
   • Cleaner Home / Plan / Spend / Trip surfaces
   • Diagnostics moved out of normal travel navigation

   NEW PERSONAL FEATURES
   • Travel Lists (custom checklist / shopping / food / photo / bucket lists)
   • Day Board (day title, theme, notes, outfit, weather note, wake/return times)
   • Reservation Board (derived booking command center)
   • Checklist Center (packing + before-you-go + custom lists)
   • Time Zone Board (user-added IANA time zones; no pre-added cities)
   • Cleaner Quick Actions and Trip Command Center

   STABILITY
   • Schema 8 migration
   • No records auto-created
   • Safe empty states
   • Drawer scroll/focus cleanup
   • Time-zone timer only runs on its screen
   • Reduced-motion / compact-density settings
   • Existing backup, offline, storage, update and recovery systems retained
   ===================================================================== */

const APP_VERSION_V8 = "8.0.0";
const APP_SCHEMA_VERSION_V8 = 8;
const CACHE_VERSION_V8 = "ichigo-build8-mega-v1";

const BOTTOM_TAB_OPTIONS_V8 = [
  {id:"home", icon:"⌂", label:"Home"},
  {id:"plan", icon:"▣", label:"Plan"},
  {id:"today", icon:"🍓", label:"Today"},
  {id:"spend", icon:"◉", label:"Spend"},
  {id:"together", icon:"♧", label:"Together"},
  {id:"trip", icon:"▤", label:"Trip"}
];

const QUICK_ACTIONS_V8 = [
  {id:"activity",icon:"🗓️",label:"Activity"},
  {id:"place",icon:"📍",label:"Place"},
  {id:"expense",icon:"💸",label:"Expense"},
  {id:"booking",icon:"🎟️",label:"Booking"},
  {id:"memory",icon:"📸",label:"Memory"},
  {id:"task",icon:"✅",label:"Task"}
];

const ROUTES_V8 = [
  {group:"Essentials", id:"home", icon:"⌂", label:"Home", view:"home"},
  {group:"Essentials", id:"today", icon:"🍓", label:"Today", view:"today"},

  {group:"Plan", id:"itinerary", icon:"🗓️", label:"Itinerary", view:"plan", sub:"itinerary"},
  {group:"Plan", id:"smart", icon:"🍓", label:"Smart Planner", view:"plan", sub:"smart"},
  {group:"Plan", id:"dayboard", icon:"🌤️", label:"Day Board", view:"plan", sub:"dayboard"},
  {group:"Plan", id:"places", icon:"📍", label:"Places", view:"plan", sub:"places"},
  {group:"Plan", id:"map", icon:"🗺️", label:"Map", view:"plan", sub:"map"},
  {group:"Plan", id:"reservationboard", icon:"🎫", label:"Reservation Board", view:"plan", sub:"reservationboard"},
  {group:"Plan", id:"bookings", icon:"🎟️", label:"Bookings", view:"plan", sub:"bookings"},
  {group:"Plan", id:"checklists", icon:"☑️", label:"Checklist Center", view:"plan", sub:"checklists"},
  {group:"Plan", id:"packing", icon:"🧳", label:"Packing", view:"plan", sub:"packing"},
  {group:"Plan", id:"before", icon:"✅", label:"Before You Go", view:"plan", sub:"before"},
  {group:"Plan", id:"lists", icon:"📝", label:"Travel Lists", view:"plan", sub:"lists"},
  {group:"Plan", id:"inbox", icon:"📥", label:"Inbox", view:"plan", sub:"inbox"},
  {group:"Plan", id:"notes", icon:"✍️", label:"Notes & Scratchpad", view:"plan", sub:"notes"},
  {group:"Plan", id:"timezones", icon:"🕒", label:"Time Zones", view:"plan", sub:"timezones"},
  {group:"Plan", id:"essentials", icon:"🆘", label:"Offline Essentials", view:"plan", sub:"essentials"},

  {group:"Money", id:"budget", icon:"💰", label:"Budget", view:"spend", sub:"budget"},
  {group:"Money", id:"expenses", icon:"🧾", label:"Expenses", view:"spend", sub:"expenses"},
  {group:"Money", id:"analytics", icon:"📈", label:"Analytics", view:"spend", sub:"analytics"},
  {group:"Money", id:"converter", icon:"💱", label:"Converter", view:"spend", sub:"converter"},
  {group:"Money", id:"split", icon:"💸", label:"Split Expenses", view:"spend", sub:"split"},

  {group:"Remember", id:"journal", icon:"📸", label:"Journal", view:"trip", sub:"memories"},
  {group:"Remember", id:"timeline", icon:"🕰️", label:"Timeline", view:"trip", sub:"timeline"},
  {group:"Remember", id:"food", icon:"🍜", label:"Food Diary", view:"trip", sub:"food"},
  {group:"Remember", id:"highlights", icon:"⭐", label:"Highlights", view:"trip", sub:"highlights"},
  {group:"Remember", id:"visited", icon:"🗺️", label:"Story Map", view:"trip", sub:"visited"},
  {group:"Remember", id:"scrapbook", icon:"📖", label:"Scrapbook", view:"trip", sub:"scrapbook"},
  {group:"Remember", id:"recap", icon:"📊", label:"Trip Recap", view:"trip", sub:"recap"},

  {group:"Together", id:"together", icon:"👥", label:"Travel Together", view:"together"},

  {group:"Trip & App", id:"health", icon:"💗", label:"Trip Health", view:"trip", sub:"health"},
  {group:"Trip & App", id:"stats", icon:"🌏", label:"Travel Stats", view:"trip", sub:"stats"},
  {group:"Trip & App", id:"info", icon:"ℹ️", label:"Trip Info", view:"trip", sub:"info"},
  {group:"Trip & App", id:"offline", icon:"📴", label:"Offline Center", view:"trip", sub:"offline"},
  {group:"Trip & App", id:"storage", icon:"💾", label:"Storage Manager", view:"trip", sub:"storage"},
  {group:"Trip & App", id:"settings", icon:"⚙️", label:"Settings", view:"trip", sub:"settings"}
];

const PLAN_META_V8 = {
  itinerary:["🗓️","Itinerary","Build the day-by-day plan."],
  smart:["🍓","Smart Planner","Turn saved places into a sensible day."],
  dayboard:["🌤️","Day Board","Keep the little details for each travel day."],
  places:["📍","Places","Save places you want to eat, shop and explore."],
  map:["🗺️","Map","See your saved and planned locations."],
  reservationboard:["🎫","Reservation Board","See reservations and confirmations at a glance."],
  bookings:["🎟️","Bookings","Store flights, stays, tickets and reservations."],
  checklists:["☑️","Checklist Center","See unfinished packing, prep and list items together."],
  packing:["🧳","Packing","Build your own packing list."],
  before:["✅","Before You Go","Keep pre-trip tasks in one place."],
  lists:["📝","Travel Lists","Create any list your trip needs."],
  inbox:["📥","Trip Inbox","Capture ideas before deciding where they belong."],
  notes:["✍️","Notes & Scratchpad","Keep trip notes and quick thoughts."],
  timezones:["🕒","Time Zones","Add only the clocks you care about."],
  essentials:["🆘","Offline Essentials","Hotel, contacts, documents and phrases."]
};

const SPEND_META_V8 = {
  budget:["💰","Budget","Set the boundaries for the trip."],
  expenses:["🧾","Expenses","Track what you actually spend."],
  analytics:["📈","Analytics","Understand your spending patterns."],
  converter:["💱","Converter","Convert currencies with offline fallback rates."],
  split:["💸","Split Expenses","Optional local expense sharing."]
};

const TRIP_META_V8 = {
  memories:["📸","Journal","Save little moments as the trip unfolds."],
  timeline:["🕰️","Timeline","Plans, spending and memories in chronological order."],
  food:["🍜","Food Diary","Meals and food memories in one place."],
  highlights:["⭐","Highlights","Your favorite places, activities and memories."],
  visited:["🗺️","Story Map","A map of places you actually visited."],
  scrapbook:["📖","Scrapbook","Your trip automatically becomes a story."],
  recap:["📊","Trip Recap","See the trip in numbers and favorite moments."],
  health:["💗","Trip Health","Catch unfinished or risky planning details."],
  stats:["🌏","Travel Stats","Your personal travel history."],
  info:["ℹ️","Trip Info","Dates, destination, cover and trip settings."],
  offline:["📴","Offline Center","See what will still work without internet."],
  storage:["💾","Storage Manager","Review photos, tickets and local files."],
  settings:["⚙️","Settings","Personalize Ichigo and manage your data."]
};

let drawerOpenV8 = false;
let timezoneTimerV8 = null;

function ensureStateV8() {
  ensureStateV7();
  state.settings.bottomTabsV8 ||= ["home","plan","today","spend","trip"];
  state.settings.quickActionsV8 ||= ["activity","place","expense","memory"];
  state.settings.drawerPinsV8 ||= [];
  state.settings.showFabV8 ??= true;
  state.settings.densityV8 ||= "comfortable";
  state.settings.reduceMotionV8 ||= "system";
  return state;
}

function ensureTripV8(t) {
  t=ensureTripV7(t);
  if(!t)return t;
  t.customLists ||= [];
  t.dayBoards ||= {};
  t.timeZones ||= [];

  t.customLists.forEach(list=>{
    list.id ||= uuid();
    list.name ||= "List";
    list.icon ||= "📝";
    list.kind ||= "Checklist";
    list.note ||= "";
    list.createdAt ||= Date.now();
    list.items ||= [];
    list.items.forEach(item=>{
      item.id ||= uuid();
      item.name ||= "";
      item.note ||= "";
      item.tag ||= "";
      item.url ||= "";
      item.estimatedCost=Number(item.estimatedCost||0);
      item.done ??= false;
      item.favorite ??= false;
      item.createdAt ||= Date.now();
    });
  });

  t.timeZones.forEach(z=>{
    z.id ||= uuid();
    z.label ||= "";
    z.timeZone ||= "";
    z.emoji ||= "🕒";
  });

  return t;
}

function migrateAllTripsV8(persist=false) {
  ensureStateV8();
  const before=Number(state.schemaVersion||1);
  state.trips=(state.trips||[]).map(ensureTripV8);
  state.migrations ||= [];
  if(before<8 && !state.migrations.some(x=>x.version===8)){
    state.migrations.push({
      version:8,
      at:Date.now(),
      note:"Ichigo 8 navigation, custom travel lists, day board, reservation board, checklist center and time zones"
    });
  }
  state.schemaVersion=APP_SCHEMA_VERSION_V8;
  state.appVersion=APP_VERSION_V8;
  if(persist)save();
}

trip = function tripV8(){
  ensureStateV8();
  return ensureTripV8(state.trips.find(x=>x.id===state.currentTripId)||state.trips[0]);
};

save=function saveV8(){
  ensureStateV8();
  state.schemaVersion=APP_SCHEMA_VERSION_V8;
  state.appVersion=APP_VERSION_V8;
  state.updatedAt=Date.now();
  setSaveStatusV7("Saving…","saving");

  try{
    const raw=JSON.stringify(state);
    localStorage.setItem(STORE,raw);

    if(raw.length>4_000_000 && !storageWarningShownV7){
      storageWarningShownV7=true;
      setTimeout(()=>notify("Ichigo's local trip data is getting large. Export a backup and review Storage Manager when convenient."),300);
    }

    clearTimeout(saveStatusTimerV7);
    saveStatusTimerV7=setTimeout(()=>setSaveStatusV7("Saved ✓","saved"),220);
  }catch(error){
    logErrorV7(error,"save-v8");
    setSaveStatusV7("Save failed","error");
    setTimeout(()=>notify("Ichigo couldn't save this change. Export a backup before making more edits."),50);
  }
};


/* A user who explored Ichigo already understands the app shell.
   Skip the older walkthrough only in that case; true first-time creators
   who did not explore can still receive onboarding. */
const createTripFromTemplateBeforeV8 = createTripFromTemplateV4;
createTripFromTemplateV4 = function createTripFromTemplateOnboardingV8(templateId,data){
  const exploredBeforeCreating=!!exploreModeV73;
  const created=createTripFromTemplateBeforeV8(templateId,data);
  exploreModeV73=false;

  if(exploredBeforeCreating){
    state.onboarding ||= {};
    state.onboarding.completed=true;
    onboardingShownV3=true;
  }

  return created;
};

/* Ichigo 8 neutral first-trip form. */
const tripTemplateFormBeforeV8 = tripTemplateFormV4;
tripTemplateFormV4 = function tripTemplateFormNeutralV8(templateId="blank") {
  if(templateId!=="blank") return tripTemplateFormBeforeV8(templateId);
  return `<form id="tripTemplateCreateFormV4" data-template-id="blank" class="form-grid">
    <div class="notice-card"><span class="notice-icon">🍓</span><span><strong>Start with a blank trip</strong><p>Nothing will be added until you add it yourself.</p></span></div>
    <div class="form-row"><label>TRIP NAME</label><input name="title" required placeholder="My next trip"></div>
    <div class="form-row"><label>DESTINATION</label><input name="destination" required placeholder="Where are you going?"></div>
    <div class="form-row two"><div><label>START</label><input name="startDate" type="date" required></div><div><label>END</label><input name="endDate" type="date" required></div></div>
    <div class="form-row two"><div><label>FLAG / EMOJI</label><input name="countryEmoji" value="✈️"></div><div><label>CURRENCY</label><select name="baseCurrency">${currencyOptions(state.settings.defaultTripCurrency)}</select></div></div>
    <button class="btn primary">Create empty trip</button>
  </form>`;
};

/* ---------- Navigation ---------- */
function routeByIdV8(id){return ROUTES_V8.find(x=>x.id===id)}

function routeActiveV8(route){
  if(!route)return false;
  if(state.currentView!==route.view)return false;
  if(route.view==="plan")return state.planView===route.sub;
  if(route.view==="spend")return state.spendView===route.sub;
  if(route.view==="trip")return state.tripView===route.sub;
  return true;
}

function navigateV8(routeId,{closeDrawer=true}={}){
  const route=routeByIdV8(routeId);
  if(!route)return;

  if(!(state.trips||[]).length){
    exploreModeV73=true;
    state.currentView=route.view;
    if(!["home","plan","today","spend","together","trip"].includes(state.currentView))state.currentView="home";
    save();
    if(closeDrawer)closeDrawerV8();
    render();
    return;
  }

  state.currentView=route.view;
  if(route.view==="plan")state.planView=route.sub;
  if(route.view==="spend")state.spendView=route.sub;
  if(route.view==="trip")state.tripView=route.sub;
  save();
  if(closeDrawer)closeDrawerV8();
  render();
}

function renderBottomNavV8(){
  const nav=document.querySelector("#bottomNavV8")||document.querySelector(".bottom-nav");
  if(!nav)return;
  ensureStateV8();
  let ids=(state.settings.bottomTabsV8||[]).filter(id=>BOTTOM_TAB_OPTIONS_V8.some(x=>x.id===id));
  if(ids.length<3)ids=["home","plan","today","spend","trip"];
  ids=ids.slice(0,5);
  nav.style.setProperty("--tab-count",ids.length);
  nav.innerHTML=ids.map(id=>{
    const item=BOTTOM_TAB_OPTIONS_V8.find(x=>x.id===id);
    const active=state.currentView===id;
    const icon=id==="today"
      ? `<span class="berry-orb"><img src="./icons/icon-192-v41.png" alt=""></span>`
      : `<span>${item.icon}</span>`;
    return `<button class="nav-item ${id==="today"?"today-nav":""} ${active?"active":""}" data-nav="${id}" aria-label="${esc(item.label)}" ${active?'aria-current="page"':""}>${icon}<small>${esc(item.label)}</small></button>`;
  }).join("");
}

function drawerRouteRowV8(route){
  const pinned=(state.settings.drawerPinsV8||[]).includes(route.id);
  return `<div class="drawer-route-row-v8 ${routeActiveV8(route)?"active":""}">
    <button class="drawer-route-v8" data-action="navigate-route-v8" data-route="${route.id}">
      <span>${route.icon}</span><strong>${esc(route.label)}</strong>
    </button>
    <button class="drawer-pin-v8 ${pinned?"pinned":""}" data-action="toggle-drawer-pin-v8" data-route="${route.id}" aria-label="${pinned?"Unpin":"Pin"} ${esc(route.label)}">${pinned?"★":"☆"}</button>
  </div>`;
}

function drawerHTMLV8(){
  const hasTrip=!!(state.trips||[]).length;
  if(!hasTrip){
    return `<div class="drawer-backdrop-v8 ${drawerOpenV8?"open":""}" data-action="close-drawer-v8"></div>
      <aside class="drawer-v8 ${drawerOpenV8?"open":""}" aria-label="Ichigo menu">
        <div class="drawer-head-v8">
          <img src="./icons/icon-192-v41.png" alt="">
          <div><strong>ichigo</strong><small>Plan sweet little adventures.</small></div>
          <button class="icon-btn" data-action="close-drawer-v8" aria-label="Close menu">✕</button>
        </div>
        <div class="drawer-empty-v8">
          <p>Explore Ichigo freely, or create your first trip whenever you're ready.</p>
          <button class="btn primary full" data-action="new-trip">＋ Create Trip</button>
          <button class="btn soft full" data-action="explore-ichigo-v73">Explore Ichigo</button>
          <div class="drawer-preview-nav-v8">
            ${[["home","⌂","Home"],["plan","▣","Plan"],["today","🍓","Today"],["spend","◉","Spend"],["together","👥","Together"],["trip","▤","Trip"]].map(([view,icon,label])=>`<button data-action="navigate-explore-v8" data-view="${view}"><span>${icon}</span>${label}</button>`).join("")}
          </div>
        </div>
        ${aboutIchigoCardV74(true)}
        <div class="drawer-footer-v8">
          <button data-action="show-whats-new-v74">What’s New</button>
          <button data-action="install-app">Install</button>
          <span>${navigator.onLine?"● Online":"○ Offline"} · v${ICHIGO_CURRENT_VERSION}</span>
        </div>
      </aside>`;
  }

  const pins=(state.settings.drawerPinsV8||[]).map(routeByIdV8).filter(Boolean);
  const groups=[...new Set(ROUTES_V8.map(x=>x.group))];

  return `<div class="drawer-backdrop-v8 ${drawerOpenV8?"open":""}" data-action="close-drawer-v8"></div>
    <aside class="drawer-v8 ${drawerOpenV8?"open":""}" aria-label="Ichigo menu">
      <div class="drawer-head-v8">
        <img src="./icons/icon-192-v41.png" alt="">
        <div><strong>ichigo</strong><small>${esc(trip().title)}</small></div>
        <button class="icon-btn" data-action="close-drawer-v8" aria-label="Close menu">✕</button>
      </div>
      <div class="drawer-utilities-v8">
        <button data-action="open-search-v3">⌕ Search</button>
        <button data-action="open-quick-add">＋ Quick Add</button>
      </div>
      <div class="drawer-scroll-v8">
        ${pins.length?`<section class="drawer-group-v8"><h3>★ Pinned</h3>${pins.map(drawerRouteRowV8).join("")}</section>`:""}
        ${groups.map(group=>`<section class="drawer-group-v8"><h3>${esc(group)}</h3>${ROUTES_V8.filter(x=>x.group===group).map(drawerRouteRowV8).join("")}</section>`).join("")}
      </div>
      <div class="drawer-footer-v8">
        <button data-action="force-update-check-v3">Check Update</button>
        <button data-action="install-app">Install</button>
        <span>${navigator.onLine?"● Online":"○ Offline"} · v${ICHIGO_CURRENT_VERSION}</span>
      </div>
    </aside>`;
}

function renderDrawerV8(){
  const root=document.querySelector("#drawerRootV8");if(!root)return;
  root.innerHTML=drawerHTMLV8();
}

function openDrawerV8(){
  drawerOpenV8=true;
  document.body.classList.add("drawer-open-v8");
  renderDrawerV8();
  requestAnimationFrame(()=>document.querySelector(".drawer-v8.open .drawer-route-v8, .drawer-v8.open .btn")?.focus({preventScroll:true}));
}

function closeDrawerV8(){
  drawerOpenV8=false;
  document.body.classList.remove("drawer-open-v8");
  renderDrawerV8();
}

function toggleDrawerPinV8(routeId){
  const pins=new Set(state.settings.drawerPinsV8||[]);
  if(pins.has(routeId))pins.delete(routeId);else pins.add(routeId);
  state.settings.drawerPinsV8=[...pins].slice(0,8);
  save();renderDrawerV8();
}

function applyDensityV8(){
  document.body.classList.toggle("density-compact-v8",state.settings.densityV8==="compact");
  const reduce=state.settings.reduceMotionV8;
  document.body.classList.toggle("force-reduced-motion-v8",reduce==="reduce");
}

function syncChromeV8(){
  applyDensityV8();
  renderBottomNavV8();
  renderDrawerV8();
  const fab=document.querySelector("#fab");
  if(fab)fab.hidden=!state.settings.showFabV8 || !(state.trips||[]).length || document.body.classList.contains("fresh-mode-v72") || document.body.classList.contains("explore-mode-v73");
}

/* ---------- Clean Home ---------- */
function homeQuickActionV8(id){
  const q=QUICK_ACTIONS_V8.find(x=>x.id===id);
  if(!q)return"";
  return `<button class="home-quick-v8" data-action="quick-add-type" data-type="${q.id}"><span>${q.icon}</span><small>${esc(q.label)}</small></button>`;
}

function renderHomeV8(){
  const t=trip(),st=status(t),health=healthCheckV4(t),date=activeDate(t);
  const ts=timelineStateV3(date,t),next=ts.current||ts.next;
  const remaining=Math.max(0,Number(t.totalBudget||0)-spent(t));
  const checklistTotal=t.packing.length+t.preTrip.length+t.customLists.reduce((s,l)=>s+l.items.length,0);
  const checklistDone=t.packing.filter(x=>x.done).length+t.preTrip.filter(x=>x.done).length+t.customLists.reduce((s,l)=>s+l.items.filter(x=>x.done).length,0);
  const nextBooking=[...t.bookings].filter(b=>b.status!=="Cancelled"&&b.date>=isoToday()).sort((a,b)=>`${a.date} ${a.time||"99:99"}`.localeCompare(`${b.date} ${b.time||"99:99"}`))[0];
  const quick=(state.settings.quickActionsV8||["activity","place","expense","memory"]).slice(0,6);
  const shelf=state.trips.filter(x=>!x.archived);

  main.innerHTML=`
    <section class="home-hero-v8">
      <div class="home-trip-title-v8">
        <div><p class="eyebrow">${st==="active"?"TRAVELING NOW":st==="planning"?"UPCOMING TRIP":"TRIP MEMORY"}</p><h1>${esc(t.countryEmoji||"✈️")} ${esc(t.title)}</h1><p>${nice(t.startDate)} – ${nice(t.endDate,{month:"short",day:"numeric",year:"numeric"})}</p></div>
        <button class="hero-menu-v8" data-action="open-drawer-v8">☰</button>
      </div>
      <div class="home-countdown-v8">${st==="planning"?`<strong>${Math.max(0,daysUntil(t.startDate))}</strong><span>days to go</span>`:st==="active"?`<strong>Day ${dayNo(date,t)}</strong><span>${esc(t.cityLabel||t.destination)}</span>`:`<strong>${daysBetween(t.startDate,t.endDate)}</strong><span>travel days</span>`}</div>
      <div class="home-hero-grid-v8">
        <button data-action="navigate-route-v8" data-route="itinerary"><span>🗓️ Plan</span><strong>${t.itinerary.length}</strong><small>activities</small></button>
        <button data-action="navigate-route-v8" data-route="budget"><span>💴 Budget left</span><strong>${t.totalBudget?money(remaining):"—"}</strong><small>${t.expenses.length} expenses</small></button>
        <button data-action="navigate-route-v8" data-route="checklists"><span>☑️ Checklists</span><strong>${checklistTotal?`${checklistDone}/${checklistTotal}`:"—"}</strong><small>completed</small></button>
        <button data-action="navigate-route-v8" data-route="health"><span>💗 Trip health</span><strong>${health.score}</strong><small>/ 100</small></button>
      </div>
    </section>

    <section class="section">
      <div class="section-title"><h3>Quick add</h3><button data-action="open-quick-add">More</button></div>
      <div class="home-quick-grid-v8">${quick.map(homeQuickActionV8).join("")}</div>
    </section>

    <section class="section home-focus-grid-v8">
      <article class="card home-focus-v8">
        <div class="section-title"><h3>${st==="active"?"🍓 Today":"🗓️ Next plan"}</h3><button data-action="navigate-route-v8" data-route="${st==="active"?"today":"itinerary"}">Open</button></div>
        ${next?`<strong>${next.flexible?esc(next.daypart||"Anytime"):esc(formatTimeV3(next.time||""))} · ${esc(next.title)}</strong><p>${esc(next.place||next.address||"")}</p>`:`<strong>Nothing scheduled yet</strong><p>Add an activity whenever you're ready.</p>`}
      </article>
      <article class="card home-focus-v8">
        <div class="section-title"><h3>🎟️ Next reservation</h3><button data-action="navigate-route-v8" data-route="reservationboard">Open</button></div>
        ${nextBooking?`<strong>${esc(nextBooking.title)}</strong><p>${nice(nextBooking.date)}${nextBooking.time?` · ${esc(formatTimeV3(nextBooking.time))}`:""}</p>`:`<strong>No upcoming booking</strong><p>Your reservation board is ready when you need it.</p>`}
      </article>
    </section>

    <section class="section">
      <div class="section-title"><h3>Your trips</h3><button data-action="new-trip">＋ New</button></div>
      <div class="home-shelf-v8">${shelf.map(x=>`<button class="home-trip-card-v8 ${x.id===t.id?"active":""}" data-action="switch-trip" data-id="${x.id}"><span>${esc(x.countryEmoji||"✈️")}</span><div><strong>${esc(x.title)}</strong><small>${nice(x.startDate,{month:"short",day:"numeric"})} – ${nice(x.endDate,{month:"short",day:"numeric"})}</small></div><b>${tripStageLabelV4(x)}</b></button>`).join("")}</div>
    </section>`;
}
renderHome=renderHomeV8;

/* ---------- New feature: Travel Lists ---------- */
function listTemplateCardsV8(){
  const templates=[
    ["🎁","Souvenirs","Shopping"],["🍜","Food to Try","Food"],["📸","Photo Spots","Photo"],
    ["🛍️","Shopping","Shopping"],["✨","Bucket List","Checklist"],["📝","Custom List","Checklist"]
  ];
  return `<div class="list-template-grid-v8">${templates.map(([icon,name,kind])=>`<button data-action="create-list-template-v8" data-icon="${icon}" data-name="${esc(name)}" data-kind="${kind}"><span>${icon}</span><strong>${esc(name)}</strong><small>Starts empty</small></button>`).join("")}</div>`;
}

function customListsHTMLV8(){
  const t=trip();
  return `<div class="section-title"><h3>Travel Lists</h3><button data-action="add-custom-list-v8">＋ New list</button></div>
    <p class="page-help-v8">Make the lists your trip actually needs. Templates create an empty list—nothing is pre-added.</p>
    ${!t.customLists.length?`${listTemplateCardsV8()}${empty("📝","No travel lists yet","Create a souvenir list, food list, photo list, bucket list or anything else.")}`:
      `<div class="custom-list-grid-v8">${t.customLists.map(list=>{
        const done=list.items.filter(x=>x.done).length,total=list.items.length,cost=list.items.reduce((s,x)=>s+Number(x.estimatedCost||0),0);
        return `<article class="card custom-list-card-v8">
          <div class="custom-list-head-v8"><span>${esc(list.icon||"📝")}</span><div><h3>${esc(list.name)}</h3><p>${esc(list.kind)}${list.note?` · ${esc(list.note)}`:""}</p></div><button class="tiny-btn" data-action="edit-custom-list-v8" data-id="${list.id}">Edit</button></div>
          <div class="custom-list-progress-v8"><div><i style="width:${total?done/total*100:0}%"></i></div><small>${done}/${total} done${cost?` · ${money(cost)} planned`:""}</small></div>
          <div class="custom-list-items-v8">${list.items.length?list.items.map(item=>`<div class="custom-list-item-v8 ${item.done?"done":""}">
            <input type="checkbox" aria-label="Mark ${esc(item.name)} complete" data-action="toggle-custom-list-item-v8" data-list-id="${list.id}" data-id="${item.id}" ${item.done?"checked":""}>
            <span class="custom-list-star-v8">${item.favorite?"★":"○"}</span>
            <span><strong>${esc(item.name)}</strong>${item.note?`<small>${esc(item.note)}</small>`:""}${item.tag?`<em>${esc(item.tag)}</em>`:""}</span>
            ${item.estimatedCost?`<b>${money(item.estimatedCost)}</b>`:"<b></b>"}
            <button class="tiny-btn" type="button" data-action="edit-custom-list-item-v8" data-list-id="${list.id}" data-id="${item.id}">Edit</button>
          </div>`).join(""):`<div class="mini-empty-v8">This list is empty.</div>`}</div>
          <div class="btn-row wrap-v3"><button class="btn soft" data-action="add-custom-list-item-v8" data-list-id="${list.id}">＋ Add item</button><button class="btn" data-action="toggle-list-favorite-v8" data-list-id="${list.id}">★ Sort favorites first</button><button class="btn danger" data-action="delete-custom-list-v8" data-list-id="${list.id}">Delete list</button></div>
        </article>`}).join("")}</div>`}`;
}

function customListFormV8(item={}){
  return `<form id="customListFormV8" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row two"><div><label>ICON</label><input name="icon" value="${esc(item.icon||"📝")}" maxlength="4"></div><div><label>TYPE</label><select name="kind">${["Checklist","Shopping","Food","Photo","Custom"].map(x=>`<option ${item.kind===x?"selected":""}>${x}</option>`).join("")}</select></div></div>
    <div class="form-row"><label>LIST NAME</label><input name="name" required value="${esc(item.name||"")}" placeholder="Souvenirs"></div>
    <div class="form-row"><label>NOTE</label><input name="note" value="${esc(item.note||"")}" placeholder="Optional"></div>
    <button class="btn primary">${item.id?"Save list":"Create empty list"}</button>
  </form>`;
}

function customListItemFormV8(list,item={}){
  return `<form id="customListItemFormV8" data-list-id="${list.id}" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row"><label>ITEM</label><input name="name" required value="${esc(item.name||"")}" placeholder="${list.kind==="Food"?"Restaurant or dish":list.kind==="Photo"?"Photo spot":"List item"}"></div>
    <div class="form-row two"><div><label>TAG</label><input name="tag" value="${esc(item.tag||"")}" placeholder="Optional"></div><div><label>EXPECTED COST</label><input name="estimatedCost" type="number" min="0" step=".01" value="${Number(item.estimatedCost||0)}"></div></div>
    <label class="check-inline-v3"><input name="favorite" type="checkbox" ${item.favorite?"checked":""}> ⭐ Favorite / priority</label>
    <div class="form-row"><label>NOTE</label><textarea name="note">${esc(item.note||"")}</textarea></div>
    <div class="form-row"><label>LINK</label><input name="url" type="url" value="${esc(item.url||"")}" placeholder="Optional"></div>
    <button class="btn primary">${item.id?"Save item":"Add item"}</button>
  </form>`;
}

/* ---------- New feature: Day Board ---------- */
function currentDayBoardDateV8(){
  const d=state.activeItineraryDate||activeDate();
  return allDates().includes(d)?d:allDates()[0];
}

function dayBoardHTMLV8(){
  const t=trip(),date=currentDayBoardDateV8(),b=t.dayBoards[date]||{};
  const bookings=t.bookings.filter(x=>x.date===date&&x.status!=="Cancelled");
  const plans=activitiesOn(date,t);
  return `<div class="section-title"><h3>Day ${dayNo(date,t)} Board</h3><button data-action="edit-day-board-v8" data-date="${date}">Edit day</button></div>
    <div class="chips compact-chips-v8">${allDates(t).map(d=>`<button class="chip ${d===date?"active":""}" data-action="set-day-board-date-v8" data-date="${d}">Day ${dayNo(d,t)}</button>`).join("")}</div>
    <section class="day-board-hero-v8">
      <div><p class="eyebrow">${nice(date,{weekday:"long",month:"long",day:"numeric"})}</p><h2>${esc(b.title||`Day ${dayNo(date,t)}`)}</h2><p>${esc(b.theme||"Add a day theme, focus or nickname.")}</p></div>
      <span>${esc(b.emoji||"🌸")}</span>
    </section>
    <div class="day-board-grid-v8">
      <article class="card"><span>⏰</span><small>Wake up</small><strong>${b.wakeTime?esc(formatTimeV3(b.wakeTime)):"—"}</strong></article>
      <article class="card"><span>🌙</span><small>Back by</small><strong>${b.returnTime?esc(formatTimeV3(b.returnTime)):"—"}</strong></article>
      <article class="card"><span>🗓️</span><small>Plans</small><strong>${plans.length}</strong></article>
      <article class="card"><span>🎟️</span><small>Reservations</small><strong>${bookings.length}</strong></article>
    </div>
    <div class="day-board-notes-v8">
      <article class="card"><h3>📝 Day note</h3><p>${esc(b.note||"Nothing added yet.")}</p></article>
      <article class="card"><h3>👗 Outfit / what to bring</h3><p>${esc(b.outfit||"Nothing added yet.")}</p></article>
      <article class="card"><h3>🌦️ Weather note</h3><p>${esc(b.weatherNote||"Add your own weather reminder or clothing note.")}</p></article>
      <article class="card"><h3>💡 Reminder</h3><p>${esc(b.reminder||"Nothing added yet.")}</p></article>
    </div>`;
}

function dayBoardFormV8(date,item={}){
  return `<form id="dayBoardFormV8" data-date="${date}" class="form-grid">
    <div class="form-row two"><div><label>DAY ICON</label><input name="emoji" value="${esc(item.emoji||"🌸")}" maxlength="4"></div><div><label>DAY TITLE</label><input name="title" value="${esc(item.title||"")}" placeholder="Kamakura day"></div></div>
    <div class="form-row"><label>THEME / FOCUS</label><input name="theme" value="${esc(item.theme||"")}" placeholder="Temples, seaside and slow food"></div>
    <div class="form-row two"><div><label>WAKE UP</label><input name="wakeTime" type="time" value="${item.wakeTime||""}"></div><div><label>BACK BY</label><input name="returnTime" type="time" value="${item.returnTime||""}"></div></div>
    <div class="form-row"><label>DAY NOTE</label><textarea name="note">${esc(item.note||"")}</textarea></div>
    <div class="form-row"><label>OUTFIT / WHAT TO BRING</label><textarea name="outfit">${esc(item.outfit||"")}</textarea></div>
    <div class="form-row"><label>WEATHER NOTE</label><textarea name="weatherNote">${esc(item.weatherNote||"")}</textarea></div>
    <div class="form-row"><label>REMINDER</label><textarea name="reminder">${esc(item.reminder||"")}</textarea></div>
    <button class="btn primary">Save Day Board</button>
  </form>`;
}

/* ---------- New feature: Reservation Board ---------- */
function reservationBoardHTMLV8(){
  const t=trip(),arr=[...t.bookings].filter(x=>x.status!=="Cancelled").sort((a,b)=>`${a.date||"9999"} ${a.time||"99:99"}`.localeCompare(`${b.date||"9999"} ${b.time||"99:99"}`));
  const upcoming=arr.filter(x=>x.date>=isoToday());
  const next=upcoming[0];
  const statuses={};arr.forEach(x=>statuses[x.status||"Saved"]=(statuses[x.status||"Saved"]||0)+1);
  const days=[...new Set(arr.map(x=>x.date).filter(Boolean))];
  return `<div class="section-title"><h3>Reservation Board</h3><button data-action="quick-add-type" data-type="booking">＋ Booking</button></div>
    <div class="reservation-summary-v8">
      <article class="card"><small>UPCOMING</small><strong>${upcoming.length}</strong><span>reservations</span></article>
      <article class="card"><small>CONFIRMED</small><strong>${arr.filter(x=>x.status==="Confirmed").length}</strong><span>ready</span></article>
      <article class="card"><small>NEEDS REVIEW</small><strong>${arr.filter(x=>!["Confirmed","Cancelled"].includes(x.status)).length}</strong><span>saved / pending</span></article>
    </div>
    ${next?`<section class="card next-reservation-v8"><p class="eyebrow">NEXT RESERVATION</p><h2>${esc(next.title)}</h2><p>${nice(next.date)}${next.time?` · ${esc(formatTimeV3(next.time))}`:""} · ${esc(next.type||"Booking")}</p><div class="btn-row wrap-v3"><button class="btn soft" data-action="edit-booking-v2" data-id="${next.id}">Open details</button>${next.link?`<a class="btn" href="${esc(next.link)}" target="_blank" rel="noopener">Open link</a>`:""}</div></section>`:""}
    ${days.length?days.map(date=>`<section class="section"><div class="section-title"><h3>${nice(date,{weekday:"short",month:"short",day:"numeric"})}</h3><span class="meta">${arr.filter(x=>x.date===date).length}</span></div><div class="list">${bookingRows(arr.filter(x=>x.date===date))}</div></section>`).join(""):empty("🎟️","No reservations yet","Add flights, hotels, restaurant bookings, tickets or anything with a confirmation.","booking")}`;
}

/* ---------- New feature: Checklist Center ---------- */
function checklistCenterHTMLV8(){
  const t=trip();
  const packing=t.packing.map(x=>({source:"Packing",icon:"🧳",id:x.id,name:x.name,done:x.done,detail:x.category||""}));
  const prep=t.preTrip.map(x=>({source:"Before You Go",icon:"✅",id:x.id,name:x.name,done:x.done,detail:x.dueDate?`Due ${nice(x.dueDate)}`:(x.detail||"")}));
  const custom=t.customLists.flatMap(list=>list.items.map(x=>({source:list.name,icon:list.icon||"📝",id:x.id,listId:list.id,name:x.name,done:x.done,detail:x.note||x.tag||""})));
  const all=[...packing,...prep,...custom],done=all.filter(x=>x.done).length;
  return `<div class="section-title"><h3>Checklist Center</h3><span class="meta">${done}/${all.length} complete</span></div>
    <div class="checklist-center-progress-v8"><div><i style="width:${all.length?done/all.length*100:0}%"></i></div><strong>${all.length?Math.round(done/all.length*100):0}%</strong></div>
    <div class="checklist-source-grid-v8">
      <button data-action="navigate-route-v8" data-route="packing"><span>🧳</span><strong>${t.packing.filter(x=>!x.done).length}</strong><small>packing left</small></button>
      <button data-action="navigate-route-v8" data-route="before"><span>✅</span><strong>${t.preTrip.filter(x=>!x.done).length}</strong><small>prep left</small></button>
      <button data-action="navigate-route-v8" data-route="lists"><span>📝</span><strong>${custom.filter(x=>!x.done).length}</strong><small>list items left</small></button>
    </div>
    ${all.length?`<div class="checklist-master-v8">${all.filter(x=>!x.done).map(x=>`<article><span>${x.icon}</span><div><strong>${esc(x.name)}</strong><small>${esc(x.source)}${x.detail?` · ${esc(x.detail)}`:""}</small></div></article>`).join("")}${done?`<details><summary>${done} completed item${done===1?"":"s"}</summary>${all.filter(x=>x.done).map(x=>`<article class="done"><span>${x.icon}</span><div><strong>${esc(x.name)}</strong><small>${esc(x.source)}</small></div></article>`).join("")}</details>`:""}</div>`:empty("☑️","Nothing to check off yet","Packing, Before You Go tasks and your own Travel Lists will collect here automatically.")}`;
}

/* ---------- New feature: Time Zone Board ---------- */
function validTimeZoneV8(zone){
  try{new Intl.DateTimeFormat("en-US",{timeZone:zone}).format();return true}catch{return false}
}
function zoneTimeV8(zone){
  try{
    return new Intl.DateTimeFormat(undefined,{timeZone:zone,timeStyle:"short",hour12:state.settings.timeFormat!=="24h"}).format(new Date());
  }catch{return"Invalid zone"}
}
function zoneDateV8(zone){
  try{return new Intl.DateTimeFormat(undefined,{timeZone:zone,weekday:"short",month:"short",day:"numeric"}).format(new Date())}catch{return""}
}
function timeZonesHTMLV8(){
  const t=trip();
  return `<div class="section-title"><h3>Time Zone Board</h3><button data-action="add-time-zone-v8">＋ Time zone</button></div>
    <p class="page-help-v8">Add only the clocks you want. Use an IANA zone such as <code>Asia/Tokyo</code>, <code>Europe/Paris</code> or <code>America/New_York</code>.</p>
    ${t.timeZones.length?`<div class="timezone-grid-v8">${t.timeZones.map(z=>`<article class="card timezone-card-v8"><span>${esc(z.emoji||"🕒")}</span><div><small>${esc(z.label||z.timeZone)}</small><strong data-timezone="${esc(z.timeZone)}">${esc(zoneTimeV8(z.timeZone))}</strong><p>${esc(zoneDateV8(z.timeZone))} · ${esc(z.timeZone)}</p></div><div><button class="tiny-btn" data-action="edit-time-zone-v8" data-id="${z.id}">Edit</button><button class="tiny-btn danger" data-action="delete-time-zone-v8" data-id="${z.id}">Delete</button></div></article>`).join("")}</div>`:empty("🕒","No time zones added","Add destination or home clocks if they're useful to you.")}`;
}
function timeZoneFormV8(item={}){
  return `<form id="timeZoneFormV8" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row two"><div><label>ICON</label><input name="emoji" value="${esc(item.emoji||"🕒")}" maxlength="4"></div><div><label>LABEL</label><input name="label" value="${esc(item.label||"")}" placeholder="Tokyo"></div></div>
    <div class="form-row"><label>IANA TIME ZONE</label><input name="timeZone" required value="${esc(item.timeZone||"")}" placeholder="Asia/Tokyo"><small class="inline-help">No city is added automatically.</small></div>
    <button class="btn primary">Save time zone</button>
  </form>`;
}
function startTimezoneTimerV8(){
  clearInterval(timezoneTimerV8);timezoneTimerV8=null;
  if(state.currentView==="plan"&&state.planView==="timezones"&&trip().timeZones.length){
    timezoneTimerV8=setInterval(()=>{
      document.querySelectorAll("[data-timezone]").forEach(el=>el.textContent=zoneTimeV8(el.dataset.timezone));
    },30000);
  }
}

/* ---------- Cleaner section renderers ---------- */
const planHTMLBeforeV8=planHTML;
planHTML=function planHTMLV8(v){
  if(v==="lists")return customListsHTMLV8();
  if(v==="dayboard")return dayBoardHTMLV8();
  if(v==="reservationboard")return reservationBoardHTMLV8();
  if(v==="checklists")return checklistCenterHTMLV8();
  if(v==="timezones")return timeZonesHTMLV8();
  return planHTMLBeforeV8(v);
};

renderPlan=function renderPlanV8(){
  const v=PLAN_META_V8[state.planView]?state.planView:"itinerary",m=PLAN_META_V8[v];
  state.planView=v;
  main.innerHTML=`<div class="clean-page-head-v8"><div><p class="eyebrow">PLAN</p><h1>${m[0]} ${esc(m[1])}</h1><p>${esc(m[2])}</p></div><button class="btn soft" data-action="open-drawer-v8">All sections</button></div><section class="section clean-section-v8">${planHTML(v)}</section>`;
};

renderSpend=function renderSpendV8(){
  const v=SPEND_META_V8[state.spendView]?state.spendView:"expenses",m=SPEND_META_V8[v];
  state.spendView=v;
  main.innerHTML=`<div class="clean-page-head-v8"><div><p class="eyebrow">MONEY</p><h1>${m[0]} ${esc(m[1])}</h1><p>${esc(m[2])}</p></div><button class="btn soft" data-action="open-drawer-v8">All sections</button></div><section class="section clean-section-v8">${spendHTML(v)}</section>`;
};

renderTrip=function renderTripV8(){
  const v=TRIP_META_V8[state.tripView]?state.tripView:"memories",m=TRIP_META_V8[v];
  state.tripView=v;
  main.innerHTML=`<div class="clean-page-head-v8"><div><p class="eyebrow">${["memories","timeline","food","highlights","visited","scrapbook","recap"].includes(v)?"REMEMBER":"TRIP"}</p><h1>${m[0]} ${esc(m[1])}</h1><p>${esc(m[2])}</p></div><button class="btn soft" data-action="open-drawer-v8">All sections</button></div><section class="section clean-section-v8">${tripHTML(v)}</section>`;
};

/* ---------- Clean production settings ---------- */
function navSettingsHTMLV8(){
  const s=state.settings;
  const selectedTabs=new Set(s.bottomTabsV8||[]);
  const quick=new Set(s.quickActionsV8||[]);
  return `<form id="navigationSettingsFormV8" class="form-grid">
    <div class="settings-subhead-v8"><h3>Bottom navigation</h3><p>Choose 3–5 destinations. Today stays special wherever you place it.</p></div>
    <div class="setting-choice-grid-v8">${BOTTOM_TAB_OPTIONS_V8.map(x=>`<label><input type="checkbox" name="bottomTabs" value="${x.id}" ${selectedTabs.has(x.id)?"checked":""}><span>${x.icon}</span><strong>${x.label}</strong></label>`).join("")}</div>
    <div class="settings-subhead-v8"><h3>Quick Add buttons</h3><p>Choose up to 6 shortcuts for Home.</p></div>
    <div class="setting-choice-grid-v8">${QUICK_ACTIONS_V8.map(x=>`<label><input type="checkbox" name="quickActions" value="${x.id}" ${quick.has(x.id)?"checked":""}><span>${x.icon}</span><strong>${x.label}</strong></label>`).join("")}</div>
    <div class="form-row two"><div><label>LAYOUT DENSITY</label><select name="densityV8"><option value="comfortable" ${s.densityV8==="comfortable"?"selected":""}>Comfortable</option><option value="compact" ${s.densityV8==="compact"?"selected":""}>Compact</option></select></div><div><label>MOTION</label><select name="reduceMotionV8"><option value="system" ${s.reduceMotionV8==="system"?"selected":""}>Follow device</option><option value="reduce" ${s.reduceMotionV8==="reduce"?"selected":""}>Reduce motion</option></select></div></div>
    <div class="switch-row"><span><strong>Floating Quick Add</strong><small>Show the + button while a trip is open.</small></span><label class="switch"><input name="showFabV8" type="checkbox" ${s.showFabV8?"checked":""}><span></span></label></div>
    <button class="btn primary">Save navigation</button>
  </form>`;
}

settingsHTML=function settingsHTMLV8(){
  const s=state.settings,n=s.notifications||{};
  return `<div class="settings-stack-v3 settings-v8">
    <section class="card settings-card-v3">
      <div class="section-title"><h3>Personal preferences</h3></div>
      <form id="settingsFormV3" class="form-grid">
        <div class="form-row two"><div><label>YOUR NAME</label><input name="travelerName" value="${esc(s.travelerName||"")}" placeholder="Optional"></div><div><label>HOME COUNTRY</label><input name="homeCountry" value="${esc(s.homeCountry||"")}" placeholder="Optional"></div></div>
        <div class="form-row two"><div><label>HOME CURRENCY</label><select name="homeCurrency">${currencyOptions(s.homeCurrency)}</select></div><div><label>DEFAULT TRIP CURRENCY</label><select name="defaultTripCurrency">${currencyOptions(s.defaultTripCurrency)}</select></div></div>
        <div class="form-row two"><div><label>DATE FORMAT</label><select name="dateFormat">${(window.ICHIGO_DATA?.dateFormats||[]).map(x=>`<option value="${x.id}" ${s.dateFormat===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div><div><label>TIME FORMAT</label><select name="timeFormat">${(window.ICHIGO_DATA?.timeFormats||[]).map(x=>`<option value="${x.id}" ${s.timeFormat===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div></div>
        <div class="form-row two"><div><label>PREFERRED MAP</label><select name="mapApp">${(window.ICHIGO_DATA?.mapApps||[]).map(x=>`<option value="${x.id}" ${s.mapApp===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div><div><label>APP THEME</label><select name="theme">${(window.ICHIGO_DATA?.themePresets||[]).map(x=>`<option value="${x.id}" ${s.theme===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></div></div>
        <button class="btn primary">Save preferences</button>
      </form>
    </section>

    <section class="card settings-card-v3"><div class="section-title"><h3>Navigation & appearance</h3></div>${navSettingsHTMLV8()}</section>

    <section class="card settings-card-v3">
      <div class="section-title"><h3>Reminders</h3><span class="meta">while Ichigo is open</span></div>
      <div class="form-row two"><div><label>ACTIVITY LEAD</label><select id="activityLeadV3">${(window.ICHIGO_DATA?.reminderLeadOptions||[]).map(x=>`<option value="${x}" ${Number(n.activityLead)===x?"selected":""}>${x} min</option>`).join("")}</select></div><div><label>BOOKING LEAD</label><select id="bookingLeadV3">${(window.ICHIGO_DATA?.reminderLeadOptions||[]).map(x=>`<option value="${x}" ${Number(n.bookingLead)===x?"selected":""}>${x} min</option>`).join("")}</select></div></div>
      <div class="btn-row wrap-v3"><button class="btn soft" data-action="enable-notifications-v3">Enable reminders</button><button class="btn" data-action="save-reminder-settings-v3">Save timing</button></div>
    </section>

    <section class="card settings-card-v3">
      <div class="section-title"><h3>Data & privacy</h3></div>
      <p class="meta">Your personal Ichigo data remains local unless you export it yourself.</p>
      <div class="btn-row wrap-v3"><button class="btn soft" data-action="export-full-backup-v3">Export full backup</button><button class="btn" data-action="import-full-backup-v3">Restore backup</button><button class="btn" data-action="navigate-route-v8" data-route="storage">Storage</button><button class="btn" data-action="navigate-route-v8" data-route="offline">Offline Center</button></div>
      <input id="importFullBackupV3" type="file" accept="application/json" hidden>
    </section>

    ${aboutIchigoCardV74()}
    <section class="card settings-card-v3"><div class="section-title"><h3>About & updates</h3><span class="badge gray">v${ICHIGO_CURRENT_VERSION}</span></div><div class="btn-row wrap-v3"><button class="btn soft" data-action="show-whats-new-v74">What’s New</button><button class="btn" data-action="force-update-check-v3">Check for update</button><button class="btn" data-action="install-app">Install Ichigo</button></div></section>

    <details class="card advanced-settings-v8"><summary>Advanced</summary><div class="advanced-settings-body-v8"><p class="meta">Recovery and diagnostics are kept here so normal travel screens stay clean.</p><div class="btn-row wrap-v3"><button class="btn" data-action="run-selftest-v3">Run diagnostics</button><button class="btn" data-action="copy-diagnostics-v3">Copy diagnostics</button><button class="btn" data-action="clear-caches-v3">Clear app caches</button></div><button class="btn danger full" data-action="reset-demo">Erase all local Ichigo data</button></div></details>
  </div>`;
};

/* Rename developer-style diagnostics page if reached from older state. */
releaseHTMLV7=function diagnosticsHTMLV8(){
  return `<div class="section-title"><h3>App Diagnostics</h3><button data-action="run-release-check-v7">Run again</button></div><div class="notice-card"><span class="notice-icon">🛠️</span><span><strong>Recovery diagnostics</strong><p>Checks local storage, media storage, the installed app shell and data references.</p></span></div><div id="releaseCheckBodyV7" class="release-check-v7"><div class="storage-loading-v7">Running checks…</div></div>`;
};


/* Close the drawer before an action opens a modal or changes screen.
   This prevents the drawer from sitting above a newly-opened modal. */
document.addEventListener("click",event=>{
  const el=event.target.closest(".drawer-v8 [data-action]");
  if(!el)return;
  if(["close-drawer-v8","toggle-drawer-pin-v8"].includes(el.dataset.action))return;
  drawerOpenV8=false;
  document.body.classList.remove("drawer-open-v8");
  document.querySelector(".drawer-v8")?.classList.remove("open");
  document.querySelector(".drawer-backdrop-v8")?.classList.remove("open");
},true);

document.addEventListener("click",event=>{
  const el=event.target.closest('[data-action="navigate-explore-v8"]');
  if(!el)return;
  exploreModeV73=true;
  state.currentView=el.dataset.view||"home";
  save();closeDrawerV8();render();
});

/* ---------- Actions ---------- */
document.addEventListener("click",event=>{
  const el=event.target.closest("[data-action]");if(!el)return;
  const a=el.dataset.action;

  if(a==="open-drawer-v8"){event.preventDefault();openDrawerV8()}
  if(a==="close-drawer-v8"){event.preventDefault();closeDrawerV8()}
  if(a==="navigate-route-v8"){event.preventDefault();navigateV8(el.dataset.route)}
  if(a==="toggle-drawer-pin-v8"){event.preventDefault();event.stopPropagation();toggleDrawerPinV8(el.dataset.route)}

  if(a==="add-custom-list-v8")openModal("New Travel List",customListFormV8())
  if(a==="create-list-template-v8"){
    const t=trip();
    t.customLists.push({id:uuid(),name:el.dataset.name,icon:el.dataset.icon,kind:el.dataset.kind,note:"",items:[],createdAt:Date.now()});
    save();render();notify(`${el.dataset.name} list created`);
  }
  if(a==="edit-custom-list-v8"){const list=trip().customLists.find(x=>x.id===el.dataset.id);if(list)openModal("Edit Travel List",customListFormV8(list))}
  if(a==="delete-custom-list-v8"){
    const list=trip().customLists.find(x=>x.id===el.dataset.listId);
    if(list&&confirm(`Delete “${list.name}” and all its items?`)){trip().customLists=trip().customLists.filter(x=>x.id!==list.id);save();render();notify("List deleted")}
  }
  if(a==="add-custom-list-item-v8"){const list=trip().customLists.find(x=>x.id===el.dataset.listId);if(list)openModal(`Add to ${list.name}`,customListItemFormV8(list))}
  if(a==="edit-custom-list-item-v8"){const list=trip().customLists.find(x=>x.id===el.dataset.listId),item=list?.items.find(x=>x.id===el.dataset.id);if(list&&item)openModal(`Edit ${list.name}`,customListItemFormV8(list,item))}
  if(a==="toggle-list-favorite-v8"){const list=trip().customLists.find(x=>x.id===el.dataset.listId);if(list){list.items.sort((a,b)=>Number(b.favorite)-Number(a.favorite)||Number(a.done)-Number(b.done)||a.createdAt-b.createdAt);save();render();notify("Favorites moved to the top")}}

  if(a==="set-day-board-date-v8"){state.activeItineraryDate=el.dataset.date;save();render()}
  if(a==="edit-day-board-v8"){const date=el.dataset.date,b=trip().dayBoards[date]||{};openModal(`Day ${dayNo(date)} Board`,dayBoardFormV8(date,b))}

  if(a==="add-time-zone-v8")openModal("Add Time Zone",timeZoneFormV8())
  if(a==="edit-time-zone-v8"){const z=trip().timeZones.find(x=>x.id===el.dataset.id);if(z)openModal("Edit Time Zone",timeZoneFormV8(z))}
  if(a==="delete-time-zone-v8"){const z=trip().timeZones.find(x=>x.id===el.dataset.id);if(z&&confirm(`Remove ${z.label||z.timeZone}?`)){trip().timeZones=trip().timeZones.filter(x=>x.id!==z.id);save();render()}}

  if(a==="install-app")install();
});

document.addEventListener("change",event=>{
  const x=event.target;
  if(x.dataset.action==="toggle-custom-list-item-v8"){
    const list=trip().customLists.find(l=>l.id===x.dataset.listId),item=list?.items.find(i=>i.id===x.dataset.id);
    if(item){item.done=x.checked;save();render()}
  }
});

document.addEventListener("submit",event=>{
  const f=event.target;
  if(!["customListFormV8","customListItemFormV8","dayBoardFormV8","timeZoneFormV8","navigationSettingsFormV8"].includes(f.id))return;
  event.preventDefault();
  const fd=new FormData(f),d=Object.fromEntries(fd.entries()),t=trip();

  if(f.id==="customListFormV8"){
    const old=f.dataset.editId?t.customLists.find(x=>x.id===f.dataset.editId):null,item=old||{id:uuid(),items:[],createdAt:Date.now()};
    Object.assign(item,{name:d.name.trim(),icon:d.icon.trim()||"📝",kind:d.kind,note:d.note.trim()});
    if(!old)t.customLists.push(item);
    save();closeModal();render();notify(old?"List updated":"List created");
  }

  if(f.id==="customListItemFormV8"){
    const list=t.customLists.find(x=>x.id===f.dataset.listId);if(!list)return;
    const old=f.dataset.editId?list.items.find(x=>x.id===f.dataset.editId):null,item=old||{id:uuid(),done:false,createdAt:Date.now()};
    Object.assign(item,{name:d.name.trim(),note:d.note.trim(),tag:d.tag.trim(),url:d.url.trim(),estimatedCost:Number(d.estimatedCost||0),favorite:!!d.favorite});
    if(!old)list.items.push(item);
    save();closeModal();render();notify(old?"Item updated":"Item added");
  }

  if(f.id==="dayBoardFormV8"){
    t.dayBoards[f.dataset.date]={emoji:d.emoji.trim()||"🌸",title:d.title.trim(),theme:d.theme.trim(),wakeTime:d.wakeTime||"",returnTime:d.returnTime||"",note:d.note.trim(),outfit:d.outfit.trim(),weatherNote:d.weatherNote.trim(),reminder:d.reminder.trim()};
    save();closeModal();render();notify("Day Board saved");
  }

  if(f.id==="timeZoneFormV8"){
    const zone=d.timeZone.trim();
    if(!validTimeZoneV8(zone)){alert("That time zone is not recognized. Try an IANA zone such as Asia/Tokyo or Europe/Paris.");return}
    const old=f.dataset.editId?t.timeZones.find(x=>x.id===f.dataset.editId):null,item=old||{id:uuid()};
    Object.assign(item,{emoji:d.emoji.trim()||"🕒",label:d.label.trim(),timeZone:zone});
    if(!old)t.timeZones.push(item);
    save();closeModal();render();notify(old?"Time zone updated":"Time zone added");
  }

  if(f.id==="navigationSettingsFormV8"){
    let tabs=fd.getAll("bottomTabs").filter(id=>BOTTOM_TAB_OPTIONS_V8.some(x=>x.id===id));
    if(tabs.length<3){alert("Choose at least 3 bottom navigation tabs.");return}
    if(tabs.length>5)tabs=tabs.slice(0,5);
    let quick=fd.getAll("quickActions").filter(id=>QUICK_ACTIONS_V8.some(x=>x.id===id)).slice(0,6);
    state.settings.bottomTabsV8=tabs;
    state.settings.quickActionsV8=quick.length?quick:["activity","place","expense","memory"];
    state.settings.densityV8=d.densityV8||"comfortable";
    state.settings.reduceMotionV8=d.reduceMotionV8||"system";
    state.settings.showFabV8=!!d.showFabV8;
    save();render();notify("Navigation updated");
  }
});

document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&drawerOpenV8)closeDrawerV8();
});

/* ---------- Final render wrapper ---------- */
const renderBeforeV8=render;
render=function renderIchigo8(){
  clearInterval(timezoneTimerV8);timezoneTimerV8=null;
  renderBeforeV8();
  syncChromeV8();
  if((state.trips||[]).length)startTimezoneTimerV8();
};



/* =====================================================================
   ICHIGO 9 — PLAYFUL TRAVEL EDITION
   Fun, personal, local-first features. Still no Supabase and no seeded
   trip content.

   NEW:
   • Adventure Jar / Pick for Me
   • Backup Plans
   • Neighborhood Bundles
   • Trip Bingo
   • Photo Missions
   • Food Passport
   • Stamp Book
   • Trip Capsule
   • Travel Awards
   • Tiny Achievements derived from real user data
   • Much richer hamburger, including no-trip Explore mode
   ===================================================================== */

const APP_VERSION_V9 = "9.0.0";
const APP_SCHEMA_VERSION_V9 = 9;
const CACHE_VERSION_V9 = "ichigo-build9-playful-v1";

Object.assign(PLAN_META_V8,{
  jar:["🎲","Adventure Jar","Let Ichigo pick from the places and ideas you already saved."],
  backup:["☔","Backup Plans","Keep rainy-day, low-energy and just-in-case alternatives ready."],
  neighborhoods:["🧺","Neighborhood Bundles","Group saved places into little area-based mini days."]
});

Object.assign(TRIP_META_V8,{
  bingo:["🎯","Trip Bingo","Make your own little travel bingo board and tick it off as you go."],
  photomissions:["📷","Photo Missions","Create playful photo challenges for the trip."],
  foodpassport:["🍓","Food Passport","Collect foods, cafés and restaurants you tried, with your own ratings."],
  stamps:["🛂","Stamp Book","Turn visited places into a personal stamp collection."],
  capsule:["💌","Trip Capsule","Write something before the trip and open it again when the trip is over."],
  awards:["🏆","Travel Awards","Give your trip its own silly and sentimental end-of-trip awards."],
  achievements:["✨","Tiny Achievements","Little milestones derived from the travel data you actually created."]
});

[
  {group:"Fun & Discover",id:"jar",icon:"🎲",label:"Adventure Jar",view:"plan",sub:"jar"},
  {group:"Fun & Discover",id:"backup",icon:"☔",label:"Backup Plans",view:"plan",sub:"backup"},
  {group:"Fun & Discover",id:"neighborhoods",icon:"🧺",label:"Neighborhood Bundles",view:"plan",sub:"neighborhoods"},
  {group:"Fun & Discover",id:"bingo",icon:"🎯",label:"Trip Bingo",view:"trip",sub:"bingo"},
  {group:"Fun & Discover",id:"photomissions",icon:"📷",label:"Photo Missions",view:"trip",sub:"photomissions"},
  {group:"Fun & Discover",id:"foodpassport",icon:"🍓",label:"Food Passport",view:"trip",sub:"foodpassport"},
  {group:"Fun & Discover",id:"stamps",icon:"🛂",label:"Stamp Book",view:"trip",sub:"stamps"},
  {group:"Fun & Discover",id:"capsule",icon:"💌",label:"Trip Capsule",view:"trip",sub:"capsule"},
  {group:"Fun & Discover",id:"awards",icon:"🏆",label:"Travel Awards",view:"trip",sub:"awards"},
  {group:"Fun & Discover",id:"achievements",icon:"✨",label:"Tiny Achievements",view:"trip",sub:"achievements"}
].forEach(route=>{
  if(!ROUTES_V8.some(x=>x.id===route.id))ROUTES_V8.splice(2,0,route);
});

function ensureTripV9(t){
  t=ensureTripV8(t);
  if(!t)return t;

  t.adventureJar ||= [];
  t.backupPlans ||= [];
  t.neighborhoodBundles ||= [];
  t.tripBingo ||= [];
  t.photoMissions ||= [];
  t.foodPassport ||= [];
  t.tripCapsule ||= {before:"",after:"",sealedAt:"",openedAt:""};
  t.travelAwards ||= [];

  const normalize=(arr,fn)=>arr.forEach(fn);

  normalize(t.adventureJar,x=>{
    x.id ||= uuid(); x.title ||= ""; x.note ||= ""; x.emoji ||= "🎲";
    x.done ??= false; x.favorite ??= false; x.createdAt ||= Date.now();
  });

  normalize(t.backupPlans,x=>{
    x.id ||= uuid(); x.title ||= ""; x.when ||= "Anytime"; x.note ||= "";
    x.link ||= ""; x.done ??= false; x.createdAt ||= Date.now();
  });

  normalize(t.neighborhoodBundles,x=>{
    x.id ||= uuid(); x.name ||= ""; x.emoji ||= "🧺"; x.placeIds ||= [];
    x.note ||= ""; x.createdAt ||= Date.now();
  });

  normalize(t.tripBingo,x=>{
    x.id ||= uuid(); x.text ||= ""; x.done ??= false; x.createdAt ||= Date.now();
  });

  normalize(t.photoMissions,x=>{
    x.id ||= uuid(); x.text ||= ""; x.done ??= false; x.memoryId ||= "";
    x.createdAt ||= Date.now();
  });

  normalize(t.foodPassport,x=>{
    x.id ||= uuid(); x.name ||= ""; x.place ||= ""; x.rating=Number(x.rating||0);
    x.note ||= ""; x.date ||= ""; x.favorite ??= false; x.createdAt ||= Date.now();
  });

  normalize(t.travelAwards,x=>{
    x.id ||= uuid(); x.title ||= ""; x.winner ||= ""; x.note ||= "";
    x.emoji ||= "🏆"; x.createdAt ||= Date.now();
  });

  return t;
}

function ensureStateV9(){
  ensureStateV8();
  state.schemaVersion=Number(state.schemaVersion||1);
  return state;
}

function migrateAllTripsV9(persist=false){
  ensureStateV9();
  const before=Number(state.schemaVersion||1);
  state.trips=(state.trips||[]).map(ensureTripV9);
  state.migrations ||= [];
  if(before<9&&!state.migrations.some(x=>x.version===9)){
    state.migrations.push({
      version:9,at:Date.now(),
      note:"Playful Travel Edition: Adventure Jar, Backup Plans, Neighborhood Bundles, Bingo, Photo Missions, Food Passport, Stamp Book, Capsule, Awards and achievements"
    });
  }
  state.schemaVersion=APP_SCHEMA_VERSION_V9;
  state.appVersion=APP_VERSION_V9;
  if(persist)save();
}

trip=function tripV9(){
  ensureStateV9();
  return ensureTripV9(state.trips.find(x=>x.id===state.currentTripId)||state.trips[0]);
};

save=function saveV9(){
  ensureStateV9();
  state.schemaVersion=APP_SCHEMA_VERSION_V9;
  state.appVersion=APP_VERSION_V9;
  state.updatedAt=Date.now();
  setSaveStatusV7("Saving…","saving");
  try{
    const raw=JSON.stringify(state);
    localStorage.setItem(STORE,raw);
    clearTimeout(saveStatusTimerV7);
    saveStatusTimerV7=setTimeout(()=>setSaveStatusV7("Saved ✓","saved"),220);
  }catch(error){
    logErrorV7(error,"save-v9");
    setSaveStatusV7("Save failed","error");
    setTimeout(()=>notify("Ichigo couldn't save this change. Export a backup before making more edits."),50);
  }
};

/* ---------- Fun drawer ---------- */
function funCountV9(route){
  if(!(state.trips||[]).length)return "";
  const t=trip();
  const map={
    jar:t.adventureJar.length,
    backup:t.backupPlans.length,
    neighborhoods:t.neighborhoodBundles.length,
    bingo:t.tripBingo.length,
    photomissions:t.photoMissions.length,
    foodpassport:t.foodPassport.length,
    stamps:t.places.filter(x=>x.visited).length,
    capsule:(t.tripCapsule.before||t.tripCapsule.after)?1:0,
    awards:t.travelAwards.length,
    achievements:achievementRowsV9(t).filter(x=>x.done).length
  };
  return map[route.id]??"";
}

drawerRouteRowV8=function drawerRouteRowV9(route){
  const pinned=(state.settings.drawerPinsV8||[]).includes(route.id);
  const count=funCountV9(route);
  return `<div class="drawer-route-row-v8 ${routeActiveV8(route)?"active":""}">
    <button class="drawer-route-v8" data-action="navigate-route-v8" data-route="${route.id}">
      <span>${route.icon}</span><strong>${esc(route.label)}</strong>${count!==""?`<em class="drawer-count-v9">${count}</em>`:""}
    </button>
    <button class="drawer-pin-v8 ${pinned?"pinned":""}" data-action="toggle-drawer-pin-v8" data-route="${route.id}" aria-label="${pinned?"Unpin":"Pin"} ${esc(route.label)}">${pinned?"★":"☆"}</button>
  </div>`;
};

const drawerHTMLBeforeV9=drawerHTMLV8;
drawerHTMLV8=function drawerHTMLPlayfulV9(){
  if((state.trips||[]).length)return drawerHTMLBeforeV9();

  const exploreRoutes=[
    ["home","⌂","Home"],["plan","▣","Planning"],["today","🍓","Today Mode"],
    ["spend","◉","Money"],["together","👥","Together"],["trip","▤","Memories"]
  ];

  const fun=[
    ["🎲","Adventure Jar"],["🎯","Trip Bingo"],["📷","Photo Missions"],
    ["🍓","Food Passport"],["🛂","Stamp Book"],["💌","Trip Capsule"]
  ];

  return `<div class="drawer-backdrop-v8 ${drawerOpenV8?"open":""}" data-action="close-drawer-v8"></div>
    <aside class="drawer-v8 ${drawerOpenV8?"open":""}" aria-label="Ichigo menu">
      <div class="drawer-head-v8">
        <img src="./icons/icon-192-v41.png" alt="">
        <div><strong>ichigo</strong><small>Explore before your first trip</small></div>
        <button class="icon-btn" data-action="close-drawer-v8" aria-label="Close menu">✕</button>
      </div>
      <div class="drawer-scroll-v8">
        <section class="drawer-welcome-v9">
          <p class="eyebrow">START ANY WAY YOU LIKE</p>
          <h2>There’s more inside Ichigo. 🍓</h2>
          <p>Browse the app first, or create an empty trip when you're ready.</p>
          <button class="btn primary full" data-action="new-trip">＋ Create Trip</button>
        </section>

        <section class="drawer-group-v8">
          <h3>Explore the app</h3>
          <div class="drawer-explore-grid-v9">${exploreRoutes.map(([view,icon,label])=>`<button data-action="navigate-explore-v8" data-view="${view}"><span>${icon}</span><strong>${label}</strong></button>`).join("")}</div>
        </section>

        <section class="drawer-group-v8">
          <h3>Fun things waiting for a trip</h3>
          <div class="drawer-fun-preview-v9">${fun.map(([icon,label])=>`<div><span>${icon}</span><strong>${label}</strong><small>Starts empty</small></div>`).join("")}</div>
        </section>

        ${aboutIchigoCardV74(true)}
      </div>
      <div class="drawer-footer-v8">
        <button data-action="show-whats-new-v74">What’s New</button>
        <button data-action="install-app">Install</button>
        <span>${navigator.onLine?"● Online":"○ Offline"} · v${ICHIGO_CURRENT_VERSION}</span>
      </div>
    </aside>`;
};

/* ---------- Adventure Jar ---------- */
function adventureJarHTMLV9(){
  const t=trip(),pool=t.adventureJar.filter(x=>!x.done);
  return `<div class="section-title"><h3>Adventure Jar</h3><button data-action="add-jar-v9">＋ Idea</button></div>
    <section class="jar-hero-v9">
      <div class="jar-berry-v9">🎲</div>
      <div><p class="eyebrow">CAN'T DECIDE?</p><h2>Let Ichigo pick.</h2><p>Add places, snacks, neighborhoods, tiny activities or whatever sounds fun. The jar only uses things you added.</p></div>
      <button class="btn primary" data-action="pick-jar-v9" ${pool.length?"":"disabled"}>Pick for me</button>
    </section>
    ${t.adventureJar.length?`<div class="jar-grid-v9">${t.adventureJar.map(x=>`<article class="card jar-card-v9 ${x.done?"done":""}">
      <span>${esc(x.emoji||"🎲")}</span><div><strong>${esc(x.title)}</strong><p>${esc(x.note||"")}</p></div>
      <button class="tiny-btn" data-action="toggle-jar-done-v9" data-id="${x.id}">${x.done?"Restore":"Done"}</button>
      <button class="tiny-btn danger" data-action="delete-jar-v9" data-id="${x.id}">Delete</button>
    </article>`).join("")}</div>`:empty("🎲","Your Adventure Jar is empty","Add only the little possibilities you actually want Ichigo to choose from.")}`;
}

function jarFormV9(item={}){
  return `<form id="jarFormV9" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row two"><div><label>EMOJI</label><input name="emoji" value="${esc(item.emoji||"🎲")}" maxlength="4"></div><div><label>IDEA</label><input name="title" required value="${esc(item.title||"")}" placeholder="Tiny adventure"></div></div>
    <div class="form-row"><label>NOTE</label><textarea name="note" placeholder="Optional">${esc(item.note||"")}</textarea></div>
    <button class="btn primary">Add to jar</button>
  </form>`;
}

function pickJarV9(){
  const pool=trip().adventureJar.filter(x=>!x.done);
  if(!pool.length){notify("Add something to the jar first.");return}
  const pick=pool[Math.floor(Math.random()*pool.length)];
  openModal("Ichigo picked…",`<div class="jar-pick-v9"><span>${esc(pick.emoji||"🎲")}</span><p class="eyebrow">YOUR LITTLE ADVENTURE</p><h2>${esc(pick.title)}</h2><p>${esc(pick.note||"")}</p><div class="btn-row"><button class="btn primary" data-action="jar-accept-v9" data-id="${pick.id}">Let's do it</button><button class="btn soft" data-action="pick-jar-v9">Pick again</button></div></div>`);
}

/* ---------- Backup Plans ---------- */
function backupPlansHTMLV9(){
  const t=trip(),groups=["Rainy day","Low energy","Closed / sold out","Anytime"];
  return `<div class="section-title"><h3>Backup Plans</h3><button data-action="add-backup-v9">＋ Backup</button></div>
    <div class="notice-card"><span class="notice-icon">☔</span><span><strong>Your Plan B drawer</strong><p>Nothing here changes the itinerary automatically. These are simply alternatives you chose in advance.</p></span></div>
    ${groups.map(g=>{const rows=t.backupPlans.filter(x=>x.when===g);return rows.length?`<section class="section"><div class="section-title"><h3>${g}</h3><span class="meta">${rows.length}</span></div><div class="backup-grid-v9">${rows.map(x=>`<article class="card backup-card-v9"><span>${g==="Rainy day"?"☔":g==="Low energy"?"🌿":g==="Closed / sold out"?"🚪":"✨"}</span><div><strong>${esc(x.title)}</strong><p>${esc(x.note||"")}</p>${x.link?`<a href="${esc(x.link)}" target="_blank" rel="noopener">Open link ↗</a>`:""}</div><button class="tiny-btn danger" data-action="delete-backup-v9" data-id="${x.id}">Delete</button></article>`).join("")}</div></section>`:""}).join("")}
    ${!t.backupPlans.length?empty("☔","No backup plans yet","Add your own rainy-day, low-energy or just-in-case alternatives."):""}`;
}

function backupFormV9(){
  return `<form id="backupFormV9" class="form-grid">
    <div class="form-row"><label>BACKUP IDEA</label><input name="title" required placeholder="Something you'd actually enjoy"></div>
    <div class="form-row"><label>USE WHEN</label><select name="when">${["Rainy day","Low energy","Closed / sold out","Anytime"].map(x=>`<option>${x}</option>`).join("")}</select></div>
    <div class="form-row"><label>NOTE</label><textarea name="note"></textarea></div>
    <div class="form-row"><label>LINK</label><input name="link" type="url" placeholder="Optional"></div>
    <button class="btn primary">Save backup</button>
  </form>`;
}

/* ---------- Neighborhood Bundles ---------- */
function neighborhoodBundlesHTMLV9(){
  const t=trip();
  return `<div class="section-title"><h3>Neighborhood Bundles</h3><button data-action="add-neighborhood-v9">＋ Bundle</button></div>
    <p class="page-help-v8">Make little area clusters from places you've already saved—perfect for “we're already nearby, what else is here?” moments.</p>
    ${t.neighborhoodBundles.length?`<div class="neighborhood-grid-v9">${t.neighborhoodBundles.map(b=>{
      const places=b.placeIds.map(id=>t.places.find(p=>p.id===id)).filter(Boolean);
      return `<article class="card neighborhood-card-v9"><div class="neighborhood-head-v9"><span>${esc(b.emoji||"🧺")}</span><div><h3>${esc(b.name)}</h3><p>${esc(b.note||"")}</p></div></div><div class="neighborhood-places-v9">${places.length?places.map(p=>`<span>${p.priority==="Must go"?"❤️":"📍"} ${esc(p.name)}</span>`).join(""):"<small>No places in this bundle yet.</small>"}</div><div class="btn-row"><button class="btn soft" data-action="edit-neighborhood-v9" data-id="${b.id}">Edit</button><button class="btn danger" data-action="delete-neighborhood-v9" data-id="${b.id}">Delete</button></div></article>`;
    }).join("")}</div>`:empty("🧺","No neighborhood bundles yet","Create your own clusters from saved places.")}`;
}

function neighborhoodFormV9(item={}){
  const t=trip(),selected=new Set(item.placeIds||[]);
  return `<form id="neighborhoodFormV9" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row two"><div><label>EMOJI</label><input name="emoji" value="${esc(item.emoji||"🧺")}" maxlength="4"></div><div><label>NAME</label><input name="name" required value="${esc(item.name||"")}" placeholder="Kichijoji afternoon"></div></div>
    <div class="form-row"><label>NOTE</label><input name="note" value="${esc(item.note||"")}"></div>
    <div class="form-row"><label>PLACES</label><div class="multi-choice-v9">${t.places.length?t.places.map(p=>`<label><input type="checkbox" name="placeIds" value="${p.id}" ${selected.has(p.id)?"checked":""}><span>${p.priority==="Must go"?"❤️":"📍"}</span><strong>${esc(p.name)}</strong></label>`).join(""):`<p class="meta">Save some places first.</p>`}</div></div>
    <button class="btn primary">Save bundle</button>
  </form>`;
}

/* ---------- Trip Bingo ---------- */
function bingoHTMLV9(){
  const t=trip(),done=t.tripBingo.filter(x=>x.done).length;
  return `<div class="section-title"><h3>Trip Bingo</h3><button data-action="add-bingo-v9">＋ Square</button></div>
    <div class="bingo-head-v9"><span>🎯</span><div><strong>${done}/${t.tripBingo.length}</strong><small>completed</small></div></div>
    ${t.tripBingo.length?`<div class="bingo-grid-v9">${t.tripBingo.map(x=>`<button class="bingo-square-v9 ${x.done?"done":""}" data-action="toggle-bingo-v9" data-id="${x.id}"><span>${x.done?"✓":"○"}</span><strong>${esc(x.text)}</strong></button>`).join("")}</div><button class="btn danger full" style="margin-top:10px" data-action="clear-bingo-v9">Clear board</button>`:empty("🎯","Your bingo board is blank","Add your own funny, specific or sentimental trip moments—nothing is pre-filled.")}`;
}

function bingoFormV9(){
  return `<form id="bingoFormV9" class="form-grid"><div class="form-row"><label>BINGO SQUARE</label><input name="text" required placeholder="Something you hope happens"></div><button class="btn primary">Add square</button></form>`;
}

/* ---------- Photo Missions ---------- */
function photoMissionsHTMLV9(){
  const t=trip(),done=t.photoMissions.filter(x=>x.done).length;
  return `<div class="section-title"><h3>Photo Missions</h3><button data-action="add-photo-mission-v9">＋ Mission</button></div>
    <div class="photo-mission-progress-v9"><div><i style="width:${t.photoMissions.length?done/t.photoMissions.length*100:0}%"></i></div><strong>${done}/${t.photoMissions.length}</strong></div>
    ${t.photoMissions.length?`<div class="photo-mission-grid-v9">${t.photoMissions.map(x=>`<article class="card photo-mission-v9 ${x.done?"done":""}"><span>${x.done?"📸":"📷"}</span><div><strong>${esc(x.text)}</strong><p>${x.done?"Mission completed":"Waiting for your shot"}</p></div><button class="tiny-btn" data-action="toggle-photo-mission-v9" data-id="${x.id}">${x.done?"Undo":"Done"}</button><button class="tiny-btn danger" data-action="delete-photo-mission-v9" data-id="${x.id}">Delete</button></article>`).join("")}</div>`:empty("📷","No photo missions yet","Add the kinds of photos you personally want to remember.")}`;
}

function photoMissionFormV9(){
  return `<form id="photoMissionFormV9" class="form-grid"><div class="form-row"><label>PHOTO MISSION</label><input name="text" required placeholder="A photo only you would care about"></div><button class="btn primary">Add mission</button></form>`;
}

/* ---------- Food Passport ---------- */
function foodPassportHTMLV9(){
  const t=trip(),rows=[...t.foodPassport].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||(b.date||"").localeCompare(a.date||""));
  const avg=rows.filter(x=>x.rating).length?rows.filter(x=>x.rating).reduce((s,x)=>s+x.rating,0)/rows.filter(x=>x.rating).length:0;
  return `<div class="section-title"><h3>Food Passport</h3><button data-action="add-food-passport-v9">＋ Food</button></div>
    <div class="food-passport-summary-v9"><div><strong>${rows.length}</strong><small>things tried</small></div><div><strong>${avg?avg.toFixed(1):"—"}</strong><small>average rating</small></div><div><strong>${rows.filter(x=>x.favorite).length}</strong><small>favorites</small></div></div>
    ${rows.length?`<div class="food-passport-grid-v9">${rows.map(x=>`<article class="card food-passport-card-v9 ${x.favorite?"favorite":""}"><div><span>🍓</span><div><strong>${esc(x.name)}</strong><p>${esc(x.place||"")}${x.date?` · ${nice(x.date)}`:""}</p></div></div><div class="food-rating-v9">${[1,2,3,4,5].map(n=>`<span class="${x.rating>=n?"on":""}">★</span>`).join("")}</div>${x.note?`<p>${esc(x.note)}</p>`:""}<div class="btn-row"><button class="tiny-btn" data-action="edit-food-passport-v9" data-id="${x.id}">Edit</button><button class="tiny-btn danger" data-action="delete-food-passport-v9" data-id="${x.id}">Delete</button></div></article>`).join("")}</div>`:empty("🍓","Your Food Passport is empty","Add only the food, cafés and restaurants you actually tried.")}`;
}

function foodPassportFormV9(item={}){
  return `<form id="foodPassportFormV9" data-edit-id="${item.id||""}" class="form-grid">
    <div class="form-row"><label>FOOD / PLACE</label><input name="name" required value="${esc(item.name||"")}" placeholder="What did you try?"></div>
    <div class="form-row two"><div><label>WHERE</label><input name="place" value="${esc(item.place||"")}"></div><div><label>DATE</label><input name="date" type="date" value="${item.date||""}"></div></div>
    <div class="form-row"><label>RATING</label><select name="rating"><option value="0">No rating</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(item.rating)===n?"selected":""}>${"★".repeat(n)}</option>`).join("")}</select></div>
    <label class="check-inline-v3"><input name="favorite" type="checkbox" ${item.favorite?"checked":""}> ⭐ Favorite</label>
    <div class="form-row"><label>NOTE</label><textarea name="note">${esc(item.note||"")}</textarea></div>
    <button class="btn primary">Save to Food Passport</button>
  </form>`;
}

/* ---------- Stamp Book ---------- */
function stampsHTMLV9(){
  const t=trip(),visited=t.places.filter(x=>x.visited);
  return `<div class="section-title"><h3>Stamp Book</h3><span class="meta">${visited.length} stamps</span></div>
    <p class="page-help-v8">Your stamp book is derived from places you marked visited—no separate data entry required.</p>
    ${visited.length?`<div class="stamp-grid-v9">${visited.map((p,i)=>`<article class="stamp-v9"><div class="stamp-ring-v9"><span>${categoryEmoji(p.category)}</span><small>${String(i+1).padStart(2,"0")}</small></div><strong>${esc(p.name)}</strong><p>${esc(p.area||p.category)}</p></article>`).join("")}</div>`:empty("🛂","No stamps yet","Mark a saved place as visited and it will appear here automatically.")}`;
}

/* ---------- Trip Capsule ---------- */
function capsuleHTMLV9(){
  const t=trip(),c=t.tripCapsule||{},complete=status(t)==="done";
  return `<div class="capsule-hero-v9"><span>💌</span><p class="eyebrow">TRIP CAPSULE</p><h2>A note across time.</h2><p>Write something before you leave. Come back to it when the trip is over.</p></div>
    <section class="card capsule-card-v9"><div class="section-title"><h3>Before the trip</h3><span class="meta">${c.before?"written":"empty"}</span></div>${c.before?`<blockquote>${esc(c.before)}</blockquote><button class="btn soft" data-action="edit-capsule-v9" data-part="before">Edit</button>`:`<button class="btn primary" data-action="edit-capsule-v9" data-part="before">Write before-trip note</button>`}</section>
    <section class="card capsule-card-v9"><div class="section-title"><h3>After the trip</h3><span class="meta">${complete?"ready":"available anytime"}</span></div>${c.after?`<blockquote>${esc(c.after)}</blockquote><button class="btn soft" data-action="edit-capsule-v9" data-part="after">Edit</button>`:`<button class="btn ${complete?"primary":"soft"}" data-action="edit-capsule-v9" data-part="after">Write after-trip note</button>`}</section>`;
}

function capsuleFormV9(part){
  const current=trip().tripCapsule?.[part]||"";
  return `<form id="capsuleFormV9" data-part="${part}" class="form-grid"><div class="form-row"><label>${part==="before"?"BEFORE THE TRIP":"AFTER THE TRIP"}</label><textarea name="text" required style="min-height:180px" placeholder="${part==="before"?"What are you excited about? What do you hope you'll remember?":"What actually mattered? What surprised you?"}">${esc(current)}</textarea></div><button class="btn primary">Save note</button></form>`;
}

/* ---------- Travel Awards ---------- */
function awardsHTMLV9(){
  const t=trip();
  return `<div class="section-title"><h3>Travel Awards</h3><button data-action="add-award-v9">＋ Award</button></div>
    <p class="page-help-v8">Make these as silly or sentimental as you want: best meal, best accidental find, prettiest station, most chaotic moment… you decide.</p>
    ${t.travelAwards.length?`<div class="award-grid-v9">${t.travelAwards.map(x=>`<article class="award-card-v9"><span>${esc(x.emoji||"🏆")}</span><small>${esc(x.title)}</small><strong>${esc(x.winner)}</strong><p>${esc(x.note||"")}</p><button class="tiny-btn danger" data-action="delete-award-v9" data-id="${x.id}">Delete</button></article>`).join("")}</div>`:empty("🏆","No awards yet","Create your own end-of-trip superlatives.")}`;
}
function awardFormV9(){
  return `<form id="awardFormV9" class="form-grid"><div class="form-row two"><div><label>EMOJI</label><input name="emoji" value="🏆" maxlength="4"></div><div><label>AWARD</label><input name="title" required placeholder="Best meal"></div></div><div class="form-row"><label>WINNER</label><input name="winner" required placeholder="Your pick"></div><div class="form-row"><label>NOTE</label><textarea name="note"></textarea></div><button class="btn primary">Add award</button></form>`;
}

/* ---------- Derived Tiny Achievements ---------- */
function achievementRowsV9(t=trip()){
  const completed=t.itinerary.filter(x=>x.completed).length;
  const visited=t.places.filter(x=>x.visited).length;
  const favorites=t.memories.filter(x=>x.favorite).length;
  const food=t.foodPassport.length;
  const listsDone=t.customLists.reduce((s,l)=>s+l.items.filter(x=>x.done).length,0);
  return [
    {icon:"🌱",title:"First little plan",detail:"Complete your first itinerary activity.",done:completed>=1},
    {icon:"📍",title:"Been there",detail:"Mark your first saved place visited.",done:visited>=1},
    {icon:"📸",title:"Memory keeper",detail:"Save your first travel memory.",done:t.memories.length>=1},
    {icon:"⭐",title:"Keeper",detail:"Favorite a memory.",done:favorites>=1},
    {icon:"🍓",title:"Taste collector",detail:"Add your first Food Passport entry.",done:food>=1},
    {icon:"☑️",title:"Tiny organizer",detail:"Complete five custom Travel List items.",done:listsDone>=5},
    {icon:"🗓️",title:"Full little day",detail:"Complete four itinerary activities on one day.",done:allDates(t).some(d=>activitiesOn(d,t).filter(x=>x.completed).length>=4)},
    {icon:"📖",title:"Story forming",detail:"Save five memories.",done:t.memories.length>=5},
    {icon:"🛂",title:"Stamp collector",detail:"Visit five saved places.",done:visited>=5},
    {icon:"💗",title:"Trip ready",detail:"Reach a Trip Health score of 90 or above.",done:healthCheckV4(t).score>=90}
  ];
}
function achievementsHTMLV9(){
  const rows=achievementRowsV9(),done=rows.filter(x=>x.done).length;
  return `<div class="section-title"><h3>Tiny Achievements</h3><span class="meta">${done}/${rows.length}</span></div>
    <p class="page-help-v8">These are calculated from your real trip data. They don't create or change any entries.</p>
    <div class="achievement-grid-v9">${rows.map(x=>`<article class="achievement-v9 ${x.done?"done":""}"><span>${x.icon}</span><div><strong>${esc(x.title)}</strong><p>${esc(x.detail)}</p></div><b>${x.done?"✓":"○"}</b></article>`).join("")}</div>`;
}

/* ---------- Plug into existing renderers ---------- */
const planHTMLBeforeV9=planHTML;
planHTML=function planHTMLPlayfulV9(v){
  if(v==="jar")return adventureJarHTMLV9();
  if(v==="backup")return backupPlansHTMLV9();
  if(v==="neighborhoods")return neighborhoodBundlesHTMLV9();
  return planHTMLBeforeV9(v);
};

const tripHTMLBeforeV9=tripHTML;
tripHTML=function tripHTMLPlayfulV9(v){
  if(v==="bingo")return bingoHTMLV9();
  if(v==="photomissions")return photoMissionsHTMLV9();
  if(v==="foodpassport")return foodPassportHTMLV9();
  if(v==="stamps")return stampsHTMLV9();
  if(v==="capsule")return capsuleHTMLV9();
  if(v==="awards")return awardsHTMLV9();
  if(v==="achievements")return achievementsHTMLV9();
  return tripHTMLBeforeV9(v);
};

/* ---------- Actions ---------- */
document.addEventListener("click",event=>{
  const el=event.target.closest("[data-action]");if(!el||!(state.trips||[]).length)return;
  const a=el.dataset.action,t=trip();

  if(a==="add-jar-v9")openModal("Add to Adventure Jar",jarFormV9());
  if(a==="pick-jar-v9")pickJarV9();
  if(a==="jar-accept-v9"){const x=t.adventureJar.find(x=>x.id===el.dataset.id);if(x){x.done=true;save();closeModal();render();notify("Have fun 🍓")}}
  if(a==="toggle-jar-done-v9"){const x=t.adventureJar.find(x=>x.id===el.dataset.id);if(x){x.done=!x.done;save();render()}}
  if(a==="delete-jar-v9"){t.adventureJar=t.adventureJar.filter(x=>x.id!==el.dataset.id);save();render()}

  if(a==="add-backup-v9")openModal("Add Backup Plan",backupFormV9());
  if(a==="delete-backup-v9"){t.backupPlans=t.backupPlans.filter(x=>x.id!==el.dataset.id);save();render()}

  if(a==="add-neighborhood-v9")openModal("New Neighborhood Bundle",neighborhoodFormV9());
  if(a==="edit-neighborhood-v9"){const x=t.neighborhoodBundles.find(x=>x.id===el.dataset.id);if(x)openModal("Edit Neighborhood Bundle",neighborhoodFormV9(x))}
  if(a==="delete-neighborhood-v9"){t.neighborhoodBundles=t.neighborhoodBundles.filter(x=>x.id!==el.dataset.id);save();render()}

  if(a==="add-bingo-v9")openModal("Add Bingo Square",bingoFormV9());
  if(a==="toggle-bingo-v9"){const x=t.tripBingo.find(x=>x.id===el.dataset.id);if(x){x.done=!x.done;save();render()}}
  if(a==="clear-bingo-v9"&&confirm("Clear your entire bingo board?")){t.tripBingo=[];save();render()}

  if(a==="add-photo-mission-v9")openModal("Add Photo Mission",photoMissionFormV9());
  if(a==="toggle-photo-mission-v9"){const x=t.photoMissions.find(x=>x.id===el.dataset.id);if(x){x.done=!x.done;save();render()}}
  if(a==="delete-photo-mission-v9"){t.photoMissions=t.photoMissions.filter(x=>x.id!==el.dataset.id);save();render()}

  if(a==="add-food-passport-v9")openModal("Food Passport",foodPassportFormV9());
  if(a==="edit-food-passport-v9"){const x=t.foodPassport.find(x=>x.id===el.dataset.id);if(x)openModal("Edit Food Passport",foodPassportFormV9(x))}
  if(a==="delete-food-passport-v9"){t.foodPassport=t.foodPassport.filter(x=>x.id!==el.dataset.id);save();render()}

  if(a==="edit-capsule-v9")openModal(el.dataset.part==="before"?"Before the Trip":"After the Trip",capsuleFormV9(el.dataset.part));
  if(a==="add-award-v9")openModal("Add Travel Award",awardFormV9());
  if(a==="delete-award-v9"){t.travelAwards=t.travelAwards.filter(x=>x.id!==el.dataset.id);save();render()}
});

document.addEventListener("submit",event=>{
  const f=event.target;
  if(!["jarFormV9","backupFormV9","neighborhoodFormV9","bingoFormV9","photoMissionFormV9","foodPassportFormV9","capsuleFormV9","awardFormV9"].includes(f.id))return;
  event.preventDefault();
  const fd=new FormData(f),d=Object.fromEntries(fd.entries()),t=trip();

  if(f.id==="jarFormV9"){
    t.adventureJar.push({id:uuid(),title:d.title.trim(),note:d.note.trim(),emoji:d.emoji.trim()||"🎲",done:false,favorite:false,createdAt:Date.now()});
  }
  if(f.id==="backupFormV9"){
    t.backupPlans.push({id:uuid(),title:d.title.trim(),when:d.when,note:d.note.trim(),link:d.link.trim(),done:false,createdAt:Date.now()});
  }
  if(f.id==="neighborhoodFormV9"){
    const old=f.dataset.editId?t.neighborhoodBundles.find(x=>x.id===f.dataset.editId):null,item=old||{id:uuid(),createdAt:Date.now()};
    Object.assign(item,{name:d.name.trim(),emoji:d.emoji.trim()||"🧺",note:d.note.trim(),placeIds:fd.getAll("placeIds")});
    if(!old)t.neighborhoodBundles.push(item);
  }
  if(f.id==="bingoFormV9"){
    t.tripBingo.push({id:uuid(),text:d.text.trim(),done:false,createdAt:Date.now()});
  }
  if(f.id==="photoMissionFormV9"){
    t.photoMissions.push({id:uuid(),text:d.text.trim(),done:false,memoryId:"",createdAt:Date.now()});
  }
  if(f.id==="foodPassportFormV9"){
    const old=f.dataset.editId?t.foodPassport.find(x=>x.id===f.dataset.editId):null,item=old||{id:uuid(),createdAt:Date.now()};
    Object.assign(item,{name:d.name.trim(),place:d.place.trim(),date:d.date||"",rating:Number(d.rating||0),favorite:!!d.favorite,note:d.note.trim()});
    if(!old)t.foodPassport.push(item);
  }
  if(f.id==="capsuleFormV9"){
    const part=f.dataset.part;
    t.tripCapsule[part]=d.text.trim();
    if(part==="before"&&!t.tripCapsule.sealedAt)t.tripCapsule.sealedAt=new Date().toISOString();
    if(part==="after")t.tripCapsule.openedAt=new Date().toISOString();
  }
  if(f.id==="awardFormV9"){
    t.travelAwards.push({id:uuid(),emoji:d.emoji.trim()||"🏆",title:d.title.trim(),winner:d.winner.trim(),note:d.note.trim(),createdAt:Date.now()});
  }

  save();closeModal();render();notify("Saved ✓");
});

/* ---------- Home: playful discovery strip ---------- */
const renderHomeBeforeV9=renderHome;
renderHome=function renderHomePlayfulV9(){
  renderHomeBeforeV9();
  const t=trip(),fun=[
    ["jar","🎲","Pick for me",`${t.adventureJar.filter(x=>!x.done).length} ideas in your jar`],
    ["bingo","🎯","Trip Bingo",`${t.tripBingo.filter(x=>x.done).length}/${t.tripBingo.length} squares`],
    ["photomissions","📷","Photo Missions",`${t.photoMissions.filter(x=>!x.done).length} waiting`],
    ["foodpassport","🍓","Food Passport",`${t.foodPassport.length} collected`]
  ];
  main.insertAdjacentHTML("beforeend",`<section class="section playful-home-v9"><div class="section-title"><h3>Fun little things</h3><button data-action="open-drawer-v8">See all</button></div><div class="playful-strip-v9">${fun.map(([route,icon,title,meta])=>`<button data-action="navigate-route-v8" data-route="${route}"><span>${icon}</span><strong>${title}</strong><small>${meta}</small></button>`).join("")}</div></section>`);
};

/* ---------- What's New ---------- */
ICHIGO_WHATS_NEW_V74.version=ICHIGO_CURRENT_VERSION;
ICHIGO_WHATS_NEW_V74.items=[
  "Fixed a startup initialization bug that could leave Ichigo on a blank screen.",
  "Added a boot watchdog so startup failures show recovery controls instead of an empty page.",
  "Rechecked every hamburger route and first-run Explore destination.",
  "Hardened local saving, navigation and service-worker update behavior for smoother use.",
  "No sample trip, travelers or fake content were added."
];



/* =====================================================================
   ICHIGO 9.1 — HAMBURGER NAVIGATION INTEGRITY FIX
   Rule: if a section is visible in the hamburger, it must open.
   ===================================================================== */

const APP_VERSION_V91 = ICHIGO_CURRENT_VERSION;
const CACHE_VERSION_V91 = "ichigo-build9-1-navfix-v1";

function routeIntegrityV91() {
  const problems=[];
  const seen=new Set();

  ROUTES_V8.forEach(route=>{
    if(seen.has(route.id))problems.push(`Duplicate route id: ${route.id}`);
    seen.add(route.id);

    if(!["home","plan","today","spend","together","trip"].includes(route.view)){
      problems.push(`Unknown view for ${route.id}: ${route.view}`);
    }
    if(route.view==="plan" && !PLAN_META_V8[route.sub])problems.push(`Missing Plan metadata: ${route.id}`);
    if(route.view==="spend" && !SPEND_META_V8[route.sub])problems.push(`Missing Spend metadata: ${route.id}`);
    if(route.view==="trip" && !TRIP_META_V8[route.sub])problems.push(`Missing Trip metadata: ${route.id}`);
  });

  return {ok:problems.length===0,problems,count:ROUTES_V8.length};
}

function exploreMetaV91(route) {
  if(!route)return {icon:"🍓",title:"Ichigo",copy:"Explore Ichigo before creating your first trip."};

  if(route.view==="plan" && PLAN_META_V8[route.sub]){
    const [icon,title,copy]=PLAN_META_V8[route.sub];
    return {icon,title,copy};
  }
  if(route.view==="spend" && SPEND_META_V8[route.sub]){
    const [icon,title,copy]=SPEND_META_V8[route.sub];
    return {icon,title,copy};
  }
  if(route.view==="trip" && TRIP_META_V8[route.sub]){
    const [icon,title,copy]=TRIP_META_V8[route.sub];
    return {icon,title,copy};
  }

  const generic={
    home:["⌂","Home","Your trip command center, quick actions and travel shelf."],
    today:["🍓","Today Mode","A focused travel-day view for plans, spending and memories."],
    together:["👥","Travel Together","Optional traveler, voting and shared-expense tools."],
    plan:["▣","Planning","Itinerary, places, bookings, checklists and smart planning."],
    spend:["◉","Money","Budgets, expenses, analytics and currency tools."],
    trip:["▤","Trip & Memories","Journal, scrapbook, recap and personal trip tools."]
  };
  const [icon,title,copy]=generic[route.view]||generic.home;
  return {icon,title,copy};
}

function exploreFeatureDetailsV91(routeId) {
  const details={
    itinerary:["Build days with fixed or flexible activities.","Add times, places, duration, notes, expected costs and travel buffers.","Reorder, duplicate, move and adjust activities later."],
    smart:["Use only the places you personally saved.","Suggest a local route order from saved coordinates.","Check distance, budget and schedule warnings."],
    dayboard:["Give each travel day its own title and mood.","Keep wake-up, return time, outfit and weather notes.","Use it as a tiny command board for the day."],
    places:["Save cafés, restaurants, shops and attractions.","Add priority, hours, coordinates, tags and expected spend.","Mark places visited and turn them into Stamp Book entries."],
    map:["See saved and planned places on a map.","Saved coordinates stay with your trip.","Map backgrounds may need internet unless previously cached."],
    reservationboard:["See upcoming reservations by date.","Highlight confirmations and items needing review.","Open the original booking entry for full details."],
    bookings:["Keep flights, hotels, restaurant reservations and tickets.","Store confirmation numbers, dates, links and local attachments.","Nothing is added unless you create it."],
    checklists:["Combine packing, pre-trip tasks and custom lists.","See what is still unfinished in one place.","Progress is calculated from your actual entries."],
    packing:["Build your own packing checklist.","Use quantities and categories.","Save reusable packing templates if you want."],
    before:["Track visa, insurance, SIM, documents and other prep tasks.","Set due dates, priorities and notes.","Starts completely empty."],
    lists:["Create souvenir, food, photo, shopping or custom lists.","Templates create an empty structure only.","Add costs, notes, favorites and completion status."],
    inbox:["Capture random travel ideas before organizing them.","Save links, notes and screenshots.","Convert captures into real trip items later."],
    notes:["Keep general Trip Notes separate from quick Scratchpad ideas.","Search both later.","Nothing is pre-written."],
    timezones:["Add only the clocks you care about.","Use standard IANA time zones.","No city is added automatically."],
    essentials:["Keep hotel details, emergency contacts, documents and phrases offline.","Store local files in the document vault.","Your information stays on this device."],
    jar:["Add your own little possibilities to the Adventure Jar.","Let Ichigo randomly pick from your unfinished ideas.","No fake suggestions are ever inserted."],
    backup:["Create rainy-day, low-energy and sold-out alternatives.","Keep Plan B ideas separate from the main itinerary.","Use them only when you choose."],
    neighborhoods:["Group saved places into small area bundles.","Useful when you are already nearby and want more options.","Bundles only contain places you select."],

    budget:["Set overall, category and day budgets.","Compare expected and actual spending.","See what remains without entering fake expenses."],
    expenses:["Record merchant, category, payment method and notes.","Attach receipt photos locally.","Entries are always user-created."],
    analytics:["See spending by day and payment method.","Calculate biggest expenses and projected spend.","Analytics appear only after you add real expenses."],
    converter:["Convert currencies with a calculator-style tool.","Refresh rates online or use saved fallback rates offline.","Choose the currencies you want."],
    split:["Optionally divide expenses between travelers.","Track who paid and who owes whom.","Travelers start empty."],

    memories:["Save photos, notes, location and memory type.","Favorite the moments you care about.","Your travel journal starts blank."],
    timeline:["Combine itinerary, expenses and memories chronologically.","View each travel day as one story.","Built entirely from data you created."],
    food:["Gather food memories and food expenses by day.","Use it as a simple food diary.","Only your real entries appear."],
    highlights:["Collect favorite places, activities and memories.","Acts like a personal best-of-the-trip page.","Favorites are chosen by you."],
    visited:["Map visited places and mapped memories.","Coordinates come from your saved entries.","No pretend visited locations."],
    scrapbook:["Turn each travel day into a scrapbook page.","Combine plans, spending, photos and notes.","Pages fill themselves from your own trip."],
    recap:["See final trip stats, spending and favorites.","Review completed activities and highlights.","Designed for after the trip."],
    bingo:["Create every bingo square yourself.","Tap squares as moments happen.","No pre-filled challenges."],
    photomissions:["Make your own playful photo challenges.","Mark each mission done when you get the shot.","Starts with zero missions."],
    foodpassport:["Collect foods and places you actually tried.","Add rating, date, note and favorite status.","Starts completely empty."],
    stamps:["Visited saved places become collectible stamps automatically.","No extra stamp data entry required.","The collection grows only when you mark places visited."],
    capsule:["Write a before-trip note and an after-trip note.","Use it as a tiny message across time.","Both sides start blank."],
    awards:["Create your own funny or sentimental trip awards.","Choose the winner and write a note.","Nothing is suggested unless you add it."],
    achievements:["Tiny milestones are derived from real usage.","They never create trip data.","Examples include first memory, five visited places and high Trip Health."],
    health:["Check schedule, packing, booking, budget and readiness gaps.","Warnings point back to the relevant section.","The score uses your actual trip data."],
    stats:["Build a personal travel history from your completed trips.","See travel days, destinations, visits and memories.","Stats remain empty until you travel."],
    info:["Edit trip name, destination, dates, currencies and cover.","Archive or export the current trip.","No hidden trip metadata is invented."],
    offline:["See what works without internet.","Prepare the core app shell before travel.","Maps and fresh rates may still need connectivity."],
    storage:["Review local photos, receipts, tickets and documents.","Find large or unused media.","Delete files intentionally when you need space."],
    settings:["Customize navigation, quick actions, theme, currencies and app behavior.","Manage backups, updates and advanced diagnostics.","Preferences start neutral and editable."],
    together:["Add travelers only if you want shared tools.","Use local group picks and expense splitting.","No default people are added."],
    home:["See trip countdown, budget, checklist progress and next plans.","Use Quick Add and jump into important tools.","Your shelf only contains trips you created."],
    today:["Focus on the current and next activity.","Quickly mark done, delay, add spending or save memories.","Before a trip exists, this remains a clean preview."]
  };
  return details[routeId]||[
    "This section is part of Ichigo's travel workflow.",
    "It remains empty until you add your own information.",
    "Create a trip whenever you're ready to use it."
  ];
}

function renderSpecificExploreRouteV91(routeId) {
  const route=routeByIdV8(routeId)||routeByIdV8("home");
  const meta=exploreMetaV91(route);
  const details=exploreFeatureDetailsV91(route.id);

  document.body.classList.remove("fresh-mode-v72");
  document.body.classList.add("explore-mode-v73");

  main.innerHTML=`
    <section class="explore-route-v91">
      <div class="explore-route-hero-v91">
        <span>${meta.icon}</span>
        <div>
          <p class="eyebrow">EXPLORE ICHIGO</p>
          <h1>${esc(meta.title)}</h1>
          <p>${esc(meta.copy)}</p>
        </div>
      </div>

      <div class="explore-route-points-v91">
        ${details.map((text,index)=>`<article><span>${["01","02","03"][index]||"•"}</span><p>${esc(text)}</p></article>`).join("")}
      </div>

      <div class="explore-route-empty-v91">
        <span>${meta.icon}</span>
        <div><strong>This section is empty by design.</strong><p>Ichigo won't add sample entries just to make the screen look busy.</p></div>
      </div>

      <div class="explore-route-actions-v91">
        <button class="btn primary" data-action="new-trip">＋ Create your first trip</button>
        <button class="btn soft" data-action="open-drawer-v8">☰ Explore another section</button>
      </div>
    </section>`;

  updateOnline();
}

/* Every visible drawer item is a real button, even before a trip exists. */
const drawerHTMLBeforeV91=drawerHTMLV8;
drawerHTMLV8=function drawerHTMLNavigationFixedV91(){
  const hasTrip=!!(state.trips||[]).length;
  if(hasTrip)return drawerHTMLBeforeV91();

  const groups=[...new Set(ROUTES_V8.map(x=>x.group))];

  return `<div class="drawer-backdrop-v8 ${drawerOpenV8?"open":""}" data-action="close-drawer-v8"></div>
    <aside class="drawer-v8 ${drawerOpenV8?"open":""}" aria-label="Ichigo menu">
      <div class="drawer-head-v8">
        <img src="./icons/icon-192-v41.png" alt="">
        <div><strong>ichigo</strong><small>Explore every section</small></div>
        <button class="icon-btn" data-action="close-drawer-v8" aria-label="Close menu">✕</button>
      </div>

      <div class="drawer-utilities-v8">
        <button data-action="navigate-explore-route-v91" data-route="home">⌂ Explore Home</button>
        <button data-action="new-trip">＋ Create Trip</button>
      </div>

      <div class="drawer-scroll-v8">
        <section class="drawer-explore-note-v91">
          <span>🍓</span>
          <div><strong>Everything below opens.</strong><p>Feature screens are previews until you create your own trip.</p></div>
        </section>

        ${groups.map(group=>`<section class="drawer-group-v8">
          <h3>${esc(group)}</h3>
          ${ROUTES_V8.filter(x=>x.group===group).map(route=>`
            <div class="drawer-route-row-v8 ${state.exploreRouteV91===route.id?"active":""}">
              <button type="button" class="drawer-route-v8" data-action="navigate-explore-route-v91" data-route="${route.id}">
                <span>${route.icon}</span><strong>${esc(route.label)}</strong><em class="drawer-open-arrow-v91">›</em>
              </button>
            </div>`).join("")}
        </section>`).join("")}

        ${aboutIchigoCardV74(true)}
      </div>

      <div class="drawer-footer-v8">
        <button data-action="show-whats-new-v74">What’s New</button>
        <button data-action="install-app">Install</button>
        <span>${navigator.onLine?"● Online":"○ Offline"} · v${ICHIGO_CURRENT_VERSION}</span>
      </div>
    </aside>`;
};

/* Route navigation now preserves the exact selected section in Explore mode. */
navigateV8=function navigateRouteFixedV91(routeId,{closeDrawer=true}={}){
  const route=routeByIdV8(routeId);
  if(!route){
    notify("That Ichigo section could not be found.");
    return;
  }

  if(!(state.trips||[]).length){
    exploreModeV73=true;
    state.exploreRouteV91=route.id;
    state.currentView=route.view;
    save();
    if(closeDrawer)closeDrawerV8();
    render();
    return;
  }

  state.exploreRouteV91="";
  state.currentView=route.view;
  if(route.view==="plan")state.planView=route.sub;
  if(route.view==="spend")state.spendView=route.sub;
  if(route.view==="trip")state.tripView=route.sub;
  save();
  if(closeDrawer)closeDrawerV8();
  render();
};

/* Final Explore renderer: exact hamburger route wins over generic previews. */
const renderExploreBeforeV91=renderExploreV73;
renderExploreV73=function renderExploreExactV91(){
  const routeId=state.exploreRouteV91;
  if(routeId && routeByIdV8(routeId)){
    renderSpecificExploreRouteV91(routeId);
    return;
  }
  renderExploreBeforeV91();
};

document.addEventListener("click",event=>{
  const el=event.target.closest('[data-action="navigate-explore-route-v91"]');
  if(!el)return;
  event.preventDefault();
  event.stopPropagation();
  exploreModeV73=true;
  state.exploreRouteV91=el.dataset.route||"home";
  const route=routeByIdV8(state.exploreRouteV91);
  state.currentView=route?.view||"home";
  save();
  closeDrawerV8();
  render();
},true);

/* Hamburger routing guard: catch any visible route button before older
   listeners can interfere. */
document.addEventListener("click",event=>{
  const el=event.target.closest('.drawer-v8 [data-action="navigate-route-v8"]');
  if(!el)return;
  event.preventDefault();
  event.stopPropagation();
  navigateV8(el.dataset.route);
},true);

function navigationDiagnosticsV91(){
  const audit=routeIntegrityV91();
  const routeIds=ROUTES_V8.map(x=>x.id);
  const clickableIds=new Set(routeIds);
  return {
    version:ICHIGO_CURRENT_VERSION,
    routes:audit.count,
    valid:audit.ok,
    problems:audit.problems,
    clickable:[...clickableIds]
  };
}




/* Ichigo 9.2 stability helpers */
let ichigoDeferredRenderFrameV92 = 0;
function requestIchigoRenderV92(){
  if(ichigoDeferredRenderFrameV92)return;
  ichigoDeferredRenderFrameV92=requestAnimationFrame(()=>{
    ichigoDeferredRenderFrameV92=0;
    try{render()}catch(error){console.error("Deferred render failed",error)}
  });
}

/* Avoid keeping expensive map instances alive after leaving their screen. */
function releaseInactiveMapsV92(){
  if(!(state.currentView==="plan"&&state.planView==="map")){
    try{if(ichigoMapInstance){ichigoMapInstance.remove();ichigoMapInstance=null}}catch{}
  }
  if(!(state.currentView==="trip"&&state.tripView==="visited")){
    try{if(storyMapV7){storyMapV7.remove();storyMapV7=null}}catch{}
  }
}

const renderBeforeRecoveryV92=render;
render=function renderRecoveryV92(){
  const result=renderBeforeRecoveryV92();
  releaseInactiveMapsV92();
  return result;
};

/* ---------- Ichigo 9 startup ---------- */
const previousAppVersionV9 = state.appVersion || "";
const legacyDemoRemovedV71 = cleanLegacyDemoV71();
migrateAllTripsV9(true);
state.appVersion = ICHIGO_CURRENT_VERSION;

if (state.trips.length) {
  applyLaunchShortcut();
  applyAppearanceV3();
} else {
  state.currentView = "home";
  document.documentElement.dataset.theme = state.settings?.theme || "strawberry";
}

save();
render();
setupServiceWorkerUpdatesV3();

const lastSeenVersionV9 = localStorage.getItem("ichigo-last-seen-app-version");
if (!lastSeenVersionV9) {
  if (previousAppVersionV9 && previousAppVersionV9 !== ICHIGO_CURRENT_VERSION) {
    localStorage.setItem("ichigo-last-seen-app-version",previousAppVersionV9);
    setTimeout(()=>showWhatsNewV74(false),500);
  } else {
    localStorage.setItem("ichigo-last-seen-app-version",ICHIGO_CURRENT_VERSION);
  }
} else if (lastSeenVersionV9 !== ICHIGO_CURRENT_VERSION) {
  setTimeout(()=>showWhatsNewV74(false),500);
}

if (legacyDemoRemovedV71) setTimeout(()=>notify("Ichigo is ready for your first trip ✓"),250);

/* Startup completed. The inline boot watchdog in index.html can stand down. */
window.__ICHIGO_BOOT_COMPLETE = true;
document.documentElement.dataset.ichigoBoot = "ready";
try {
  const navAudit = navigationDiagnosticsV91();
  if (!navAudit.valid) console.warn("Ichigo navigation audit", navAudit.problems);
} catch (error) {
  console.warn("Ichigo navigation audit unavailable", error);
}

