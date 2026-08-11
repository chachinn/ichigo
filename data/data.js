/* ==========================================================
   ICHIGO DATA PACK — BUILD 2
   LOCATION: /data/data.js
   Static starter data used by the local-first app.
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