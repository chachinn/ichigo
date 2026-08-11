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
  travelerName: "Me",
  homeCountry: "Philippines",
  homeCurrency: "PHP",
  defaultTripCurrency: "JPY",
  dateFormat: "friendly",
  timeFormat: "12h",
  mapApp: "apple",
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

    <section class="card settings-card-v3"><button class="btn danger full" data-action="reset-demo">Reset demo data</button></section>
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
function showUpdateBannerV3(reg){pendingSWRegistrationV3=reg;const host=document.querySelector("#appUpdateHost");if(!host||host.querySelector(".update-banner-v3"))return;host.innerHTML=`<div class="update-banner-v3"><span>🍓 <strong>A new Ichigo version is ready.</strong></span><button class="tiny-btn primary" data-action="apply-update-v3">Update</button></div>`}
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
  if(f.id==="settingsFormV3"){state.settings.travelerName=d.travelerName.trim()||"Me";state.settings.homeCountry=d.homeCountry.trim();state.settings.homeCurrency=d.homeCurrency;state.settings.defaultTripCurrency=d.defaultTripCurrency;state.settings.dateFormat=d.dateFormat;state.settings.timeFormat=d.timeFormat;state.settings.mapApp=d.mapApp;state.settings.theme=d.theme;save();applyAppearanceV3();render();notify("Preferences saved")}
  if(f.id==="tripFormV3"){const n=ensureTripV3({id:uuid(),title:d.title.trim(),destination:d.destination.trim(),cityLabel:d.destination.toUpperCase(),countryEmoji:d.countryEmoji||"✈️",startDate:d.startDate,endDate:d.endDate,baseCurrency:d.baseCurrency,homeCurrency:state.settings.homeCurrency,totalBudget:0,dailyBudget:0,categoryBudgets:{},coverKey:"",theme:"inherit",accentColor:"",travelers:[{id:uuid(),name:state.settings.travelerName||"Me",role:"Owner",emoji:"🙂"}],itinerary:[],places:[],bookings:[],packing:[],preTrip:[],expenses:[],memories:[],inbox:[]});state.trips.push(n);state.currentTripId=n.id;state.currentView="home";save();closeModal();render();notify("New trip created 🍓")}
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

/* Build 3 startup */
migrateAllTripsV3(true);
applyLaunchShortcut();
applyAppearanceV3();
save();
render();
setupServiceWorkerUpdatesV3();