/* ==========================================================
   ICHIGO DATA PACK — BUILD 3
   LOCATION: /data/data.js
   Static starter data, themes and preferences used by the local-first app.
   Keep this file inside /data/ and load it before app.js.
   ========================================================== */

window.ICHIGO_DATA = {
  currencies: ["JPY", "PHP", "USD", "GBP", "EUR", "SGD", "HKD", "CNY"],

  expenseCategories: [
    { name: "Accommodation", icon: "🏨" },
    { name: "Food", icon: "🍜" },
    { name: "Transport", icon: "🚃" },
    { name: "Shopping", icon: "🛍️" },
    { name: "Activities", icon: "🎟️" },
    { name: "Other", icon: "✨" }
  ],

  paymentMethods: ["Cash", "Credit Card", "Debit Card", "IC Card", "E-wallet", "Other"],
  placeCategories: ["Café", "Restaurant", "Attraction", "Shopping", "Hotel", "Station", "Viewpoint", "Other"],
  bookingTypes: ["Flight", "Hotel", "Train", "Ticket", "Restaurant", "Activity", "Other"],

  packingTemplates: {
    "Quick essentials": [
      ["Essentials", "Passport", 1],
      ["Essentials", "Wallet / cards", 1],
      ["Essentials", "Cash", 1],
      ["Electronics", "Phone charger", 1],
      ["Electronics", "Power bank", 1],
      ["Toiletries", "Skincare", 1],
      ["Health", "Regular medicines", 1]
    ],
    "Japan trip": [
      ["Essentials", "Passport", 1],
      ["Essentials", "Wallet / cards", 1],
      ["Essentials", "Japanese yen", 1],
      ["Essentials", "IC / transit card", 1],
      ["Clothing", "Daily outfits", 7],
      ["Clothing", "Comfortable walking shoes", 1],
      ["Clothing", "Light jacket / layer", 1],
      ["Electronics", "Phone charger", 1],
      ["Electronics", "Power bank", 1],
      ["Electronics", "Travel adapter if needed", 1],
      ["Toiletries", "Skincare", 1],
      ["Toiletries", "Toothbrush", 1],
      ["Health", "Regular medicines", 1],
      ["Health", "Small first-aid kit", 1],
      ["Documents", "Hotel confirmation", 1],
      ["Documents", "Travel insurance copy", 1]
    ],
    "Weekend trip": [
      ["Essentials", "Wallet / cards", 1],
      ["Clothing", "Outfits", 3],
      ["Clothing", "Sleepwear", 1],
      ["Electronics", "Phone charger", 1],
      ["Toiletries", "Toiletry pouch", 1],
      ["Health", "Regular medicines", 1]
    ]
  },

  preTripTemplate: [
    { category: "Documents", name: "Check passport validity", detail: "Keep an offline copy of the details page", priority: "High" },
    { category: "Documents", name: "Confirm visa / entry requirements", detail: "Save approval or reference details", priority: "High" },
    { category: "Safety", name: "Buy travel insurance", detail: "Save policy and emergency contact offline", priority: "High" },
    { category: "Connectivity", name: "Prepare SIM / eSIM", detail: "Install before departure when possible", priority: "Medium" },
    { category: "Money", name: "Prepare starter cash", detail: "Keep a small amount for arrival day", priority: "Medium" },
    { category: "Money", name: "Enable cards for international use", detail: "Check fees and travel notices", priority: "Medium" },
    { category: "Offline", name: "Save itinerary offline", detail: "Keep hotel and transport details available without data", priority: "High" },
    { category: "Safety", name: "Save emergency contacts", detail: "Include insurance and local contacts", priority: "High" },
    { category: "Transport", name: "Check airport transfer", detail: "Know the first route after arrival", priority: "Medium" },
    { category: "Home", name: "Check home / pet arrangements", detail: "Finish anything needed before leaving", priority: "Low" }
  ],

  japanPhrases: [
    { jp: "すみません", romaji: "Sumimasen", en: "Excuse me / sorry" },
    { jp: "ありがとうございます", romaji: "Arigatou gozaimasu", en: "Thank you very much" },
    { jp: "これをください", romaji: "Kore o kudasai", en: "This one, please" },
    { jp: "いくらですか？", romaji: "Ikura desu ka?", en: "How much is it?" },
    { jp: "カードは使えますか？", romaji: "Kaado wa tsukaemasu ka?", en: "Can I use a card?" },
    { jp: "トイレはどこですか？", romaji: "Toire wa doko desu ka?", en: "Where is the restroom?" },
    { jp: "この電車は＿＿に行きますか？", romaji: "Kono densha wa __ ni ikimasu ka?", en: "Does this train go to __?" },
    { jp: "英語は話せますか？", romaji: "Eigo wa hanasemasu ka?", en: "Do you speak English?" },
    { jp: "助けてください", romaji: "Tasukete kudasai", en: "Please help me" },
    { jp: "アレルギーがあります", romaji: "Arerugii ga arimasu", en: "I have an allergy" }
  ]
};


/* Build 3 configuration. Kept outside the original object literal so older
   installs can load this file without needing a destructive data reset. */
Object.assign(window.ICHIGO_DATA, {
  appVersion: "3.0.0",
  schemaVersion: 3,

  inboxTypes: ["Place idea", "Activity idea", "Booking", "Food", "Link", "Note", "Screenshot"],

  themePresets: [
    { id: "strawberry", label: "Strawberry Milk", accent: "#ff6f91" },
    { id: "lavender", label: "Lavender Sky", accent: "#9b7ad8" },
    { id: "peach", label: "Peach Sorbet", accent: "#f28e78" },
    { id: "matcha", label: "Matcha Cream", accent: "#79a878" },
    { id: "blueberry", label: "Blueberry Milk", accent: "#738ec8" }
  ],

  mapApps: [
    { id: "apple", label: "Apple Maps" },
    { id: "google", label: "Google Maps" }
  ],

  dateFormats: [
    { id: "friendly", label: "Oct 20, 2026" },
    { id: "dmy", label: "20/10/2026" },
    { id: "mdy", label: "10/20/2026" },
    { id: "iso", label: "2026-10-20" }
  ],

  timeFormats: [
    { id: "12h", label: "9:42 AM" },
    { id: "24h", label: "09:42" }
  ],

  reminderLeadOptions: [5, 10, 15, 30, 60, 120]
});


/* Personal Build 4 starter data. */
Object.assign(window.ICHIGO_DATA, {
  appVersion: "4.0.0",
  schemaVersion: 4,

  documentCategories: [
    "Passport", "Visa", "Insurance", "Hotel", "Flight", "Train",
    "Ticket", "Medical", "Emergency", "Other"
  ],

  tripTemplates: [
    {
      id: "japan-explorer",
      label: "Japan Explorer",
      emoji: "🇯🇵",
      description: "A practical Japan starter with packing and pre-trip prep.",
      days: 7,
      defaults: { destination: "Japan", countryEmoji: "🇯🇵", baseCurrency: "JPY" },
      packingTemplate: "Japan trip",
      useDefaultPreTrip: true
    },
    {
      id: "weekend-city",
      label: "Weekend City Break",
      emoji: "🏙️",
      description: "A light 3-day structure for quick city trips.",
      days: 3,
      packingTemplate: "Weekend trip",
      useDefaultPreTrip: true,
      starterDay: [
        { time: "09:00", title: "Breakfast", type: "cafe", duration: 60, travelTime: 0 },
        { time: "10:30", title: "Morning area", type: "place", duration: 150, travelTime: 20 },
        { time: "13:30", title: "Lunch", type: "food", duration: 75, travelTime: 20 },
        { time: "15:30", title: "Afternoon activity", type: "attraction", duration: 150, travelTime: 20 },
        { time: "19:00", title: "Dinner", type: "food", duration: 90, travelTime: 30 }
      ]
    },
    {
      id: "relaxed-trip",
      label: "Slow & Relaxed",
      emoji: "🌿",
      description: "Fewer plans, generous buffers and flexible afternoons.",
      days: 5,
      packingTemplate: "Quick essentials",
      useDefaultPreTrip: true,
      starterDay: [
        { time: "09:30", title: "Slow breakfast", type: "cafe", duration: 90, travelTime: 0 },
        { time: "11:30", title: "Main activity", type: "attraction", duration: 180, travelTime: 30 },
        { time: "", title: "Flexible afternoon", type: "place", duration: 180, travelTime: 30, flexible: true },
        { time: "18:30", title: "Dinner", type: "food", duration: 90, travelTime: 30 }
      ]
    },
    {
      id: "work-trip",
      label: "Work Trip",
      emoji: "💼",
      description: "Travel essentials with simple work-day blocks.",
      days: 4,
      packingTemplate: "Quick essentials",
      useDefaultPreTrip: true,
      starterDay: [
        { time: "08:00", title: "Breakfast", type: "cafe", duration: 45, travelTime: 0 },
        { time: "09:00", title: "Work / meeting", type: "activity", duration: 180, travelTime: 15 },
        { time: "12:30", title: "Lunch", type: "food", duration: 60, travelTime: 15 },
        { time: "14:00", title: "Work / meeting", type: "activity", duration: 180, travelTime: 15 },
        { time: "19:00", title: "Dinner / free time", type: "food", duration: 90, travelTime: 30 }
      ]
    }
  ],

  journalPrompts: [
    "Best thing I ate today",
    "Favorite little moment",
    "Something unexpected",
    "A place I would come back to",
    "Something I learned today",
    "The funniest thing that happened"
  ]
});


/* Ichigo Builds 5–7: smart planning, story and release-readiness data. */
Object.assign(window.ICHIGO_DATA, {
  appVersion: "7.0.0-personal",
  schemaVersion: 7,

  planningPacesV7: [
    { id:"relaxed", label:"🌿 Relaxed — more breathing room", buffer:20 },
    { id:"comfortable", label:"🌸 Comfortable — balanced", buffer:12 },
    { id:"busy", label:"🍓 Busy — fit more in", buffer:6 }
  ],

  dashboardWidgetsV7: [
    { id:"mustgo", icon:"❤️", label:"Must-Go waiting", description:"Saved Must-Go places still missing from the itinerary." },
    { id:"intensity", icon:"🌸", label:"Day intensity", description:"Relaxed, Comfortable, Busy or Packed for the active day." },
    { id:"daybudget", icon:"💴", label:"Day budget", description:"How much of the active day's budget remains." },
    { id:"scratchpad", icon:"⚡", label:"Scratchpad", description:"Count of quick travel notes waiting for you." },
    { id:"recent", icon:"🕘", label:"Recently changed", description:"The latest meaningful edit to the current trip." },
    { id:"storage", icon:"💾", label:"Local media", description:"Approximate size of locally stored Ichigo attachments." }
  ],

  journalPromptsV7: [
    "Best thing I ate today",
    "Favorite little moment",
    "Something unexpected",
    "A place I would happily return to",
    "What made me laugh today?",
    "Something I noticed that I would have missed at home",
    "Best view of the day",
    "A tiny kindness I received or saw",
    "What did today sound or smell like?",
    "One thing I want to remember five years from now",
    "The most 'this trip' moment today",
    "Something that did not go to plan — and what happened instead"
  ]
});
