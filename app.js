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

  const seedCoordinates = {
    "Ichiran Ramen": [35.6938, 139.7034],
    "Pokémon Café": [35.6812, 139.7737],
    "teamLab Planets": [35.6491, 139.7899],
    "Harajuku Takeshita St.": [35.6717, 139.7030],
    "Shibuya Sky": [35.6584, 139.7022]
  };

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
    if ((!p.lat || !p.lng) && seedCoordinates[p.name]) [p.lat, p.lng] = seedCoordinates[p.name];
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
  return `<div class="card" style="padding:16px"><div class="section-title"><h3>Local data</h3></div><p class="meta">Build 2 keeps structured trip data in localStorage and photos / attachments in IndexedDB. Your app still has no account or server dependency.</p><div class="btn-row" style="margin-top:12px"><button class="btn soft" data-action="export-data">Export JSON data</button><button class="btn" data-action="import-data">Import JSON data</button></div><input id="importFile" type="file" accept="application/json" hidden><p class="inline-help">The JSON backup contains trip records but not the separate IndexedDB photo/attachment blobs.</p><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><div class="section-title"><h3>PWA / offline</h3></div><p class="meta">Core screens and local trip information are cached. Online map tiles and live exchange-rate refresh need a connection.</p><button class="btn soft" data-action="install-app">Install Ichigo</button><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><button class="btn danger full" data-action="reset-demo">Reset demo data</button></div>`;
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
    const n=ensureTripV2({id:uuid(),title:d.title.trim(),destination:d.destination.trim(),cityLabel:d.destination.toUpperCase(),countryEmoji:d.countryEmoji||"✈️",startDate:d.startDate,endDate:d.endDate,baseCurrency:d.baseCurrency,homeCurrency:"PHP",totalBudget:0,dailyBudget:0,categoryBudgets:{},coverKey:"",travelers:[{id:uuid(),name:"Me",role:"Owner",emoji:"🙂"}],itinerary:[],places:[],bookings:[],packing:[],preTrip:[],expenses:[],memories:[]});state.trips.push(n);state.currentTripId=n.id;state.currentView="home";save();closeModal();render();notify("New trip created 🍓");
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


/* Ichigo Build 2 startup */
migrateAllTripsV2();
applyLaunchShortcut();
save();
render();