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

const demoTrip={
  id:uuid(), title:"Japan 2026", destination:"Japan", cityLabel:"TOKYO", countryEmoji:"🇯🇵",
  startDate:"2026-10-18", endDate:"2026-10-24", baseCurrency:"JPY", homeCurrency:"PHP",
  totalBudget:180000, dailyBudget:12000,
  travelers:[
    {id:"cha",name:"Cha",role:"Owner",emoji:"👩🏻"},
    {id:"martin",name:"Martin",role:"Member",emoji:"👨🏻"}
  ],
  itinerary:[
    {id:uuid(),date:"2026-10-20",time:"08:30",title:"Breakfast",place:"Shinjuku",type:"cafe",notes:""},
    {id:uuid(),date:"2026-10-20",time:"10:00",title:"Shinjuku → Kamakura",place:"Train",type:"transport",notes:"Train departs 9:42 AM"},
    {id:uuid(),date:"2026-10-20",time:"11:15",title:"Hasedera Temple",place:"Kamakura",type:"attraction",notes:""},
    {id:uuid(),date:"2026-10-20",time:"13:00",title:"Lunch",place:"Enoshima area",type:"food",notes:""},
    {id:uuid(),date:"2026-10-20",time:"15:30",title:"Enoshima",place:"Explore & walk around",type:"place",notes:""}
  ],
  places:[
    {id:uuid(),name:"Ichiran Ramen",area:"Shinjuku",category:"Restaurant",notes:"",votes:{cha:"❤️",martin:"👍"},visited:false},
    {id:uuid(),name:"Pokémon Café",area:"Nihonbashi",category:"Café",notes:"",votes:{cha:"❤️",martin:"😐"},visited:false},
    {id:uuid(),name:"teamLab Planets",area:"Toyosu",category:"Attraction",notes:"",votes:{cha:"❤️",martin:"👍"},visited:false},
    {id:uuid(),name:"Harajuku Takeshita St.",area:"Harajuku",category:"Shopping",notes:"",votes:{cha:"👍",martin:"👍"},visited:false},
    {id:uuid(),name:"Shibuya Sky",area:"Shibuya",category:"Attraction",notes:"",votes:{cha:"❤️",martin:"👍"},visited:false}
  ],
  bookings:[
    {id:uuid(),type:"Flight",title:"Flight to Tokyo (NRT)",date:"2026-10-18",time:"15:30",confirmation:"PR 434",notes:"MNL → NRT",status:"Confirmed"},
    {id:uuid(),type:"Hotel",title:"Hotel Gracery Shinjuku",date:"2026-10-18",time:"",confirmation:"6 nights",notes:"Oct 18–24",status:"Confirmed"},
    {id:uuid(),type:"Ticket",title:"Tokyo Disneyland Ticket",date:"2026-10-21",time:"",confirmation:"2 × 1-Day Passport",notes:"",status:"Confirmed"}
  ],
  packing:[
    {id:uuid(),category:"Essentials",name:"Passport",done:true},{id:uuid(),category:"Essentials",name:"Wallet / cards",done:true},
    {id:uuid(),category:"Clothing",name:"7 outfits",done:false},{id:uuid(),category:"Clothing",name:"Comfortable shoes",done:false},
    {id:uuid(),category:"Toiletries",name:"Skincare",done:true},{id:uuid(),category:"Electronics",name:"Phone charger",done:false},
    {id:uuid(),category:"Electronics",name:"Power bank",done:false}
  ],
  preTrip:[
    {id:uuid(),name:"Passport",detail:"Check validity",done:true},{id:uuid(),name:"Visa",detail:"Confirm requirements",done:true},
    {id:uuid(),name:"Travel Insurance",detail:"Save policy offline",done:false},{id:uuid(),name:"SIM / eSIM",detail:"Install before departure",done:false},
    {id:uuid(),name:"Cash",detail:"Prepare starter cash",done:false},{id:uuid(),name:"Credit / Debit Card",detail:"Enable international use",done:false},
    {id:uuid(),name:"Itinerary Print / Offline",detail:"Save backup",done:false},{id:uuid(),name:"Emergency Contacts",detail:"Save offline",done:false}
  ],
  expenses:[
    {id:uuid(),date:"2026-10-20",title:"Breakfast",category:"Food",amount:1420,payment:"Card",paidBy:"cha",participants:["cha"],split:"personal"},
    {id:uuid(),date:"2026-10-20",title:"Train tickets",category:"Transport",amount:5000,payment:"IC Card",paidBy:"martin",participants:["cha","martin"],split:"equal"}
  ],
  memories:[]
};

const initial={currentTripId:demoTrip.id,currentView:"home",planView:"itinerary",spendView:"budget",tripView:"memories",trips:[demoTrip]};
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
    return Array.isArray(x.trips)&&x.trips.length?x:clone(initial);
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
  return `<div class="card" style="padding:16px"><div class="section-title"><h3>Local data</h3></div><p class="meta">Build 1 stores your trip on this device. No login or backend is required.</p><div class="btn-row" style="margin-top:12px"><button class="btn soft" data-action="export-data">Export backup</button><button class="btn" data-action="import-data">Import backup</button></div><input id="importFile" type="file" accept="application/json" hidden><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><div class="section-title"><h3>PWA / offline</h3></div><p class="meta">Install Ichigo from your browser. The app shell is cached by the service worker.</p><button class="btn soft" data-action="install-app">Install Ichigo</button><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><button class="btn danger full" data-action="reset-demo">Reset Build 1 demo data</button></div>`
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
  if(a==="reset-demo"&&confirm("Reset Ichigo Build 1 and erase local changes on this device?")){localStorage.removeItem(STORE);state=clone(initial);save();render();notify("Demo reset")}
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
  if(f.id==="tripForm"){const n={id:uuid(),title:d.title.trim(),destination:d.destination.trim(),cityLabel:d.destination.toUpperCase(),countryEmoji:d.countryEmoji||"✈️",startDate:d.startDate,endDate:d.endDate,baseCurrency:d.baseCurrency,homeCurrency:"PHP",totalBudget:0,dailyBudget:0,travelers:[{id:uuid(),name:"Me",role:"Owner",emoji:"🙂"}],itinerary:[],places:[],bookings:[],packing:[],preTrip:[],expenses:[],memories:[]};state.trips.push(n);state.currentTripId=n.id;state.currentView="home";save();closeModal();render();notify("New trip created 🍓")}
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

if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.warn));

applyLaunchShortcut();
save();
render();