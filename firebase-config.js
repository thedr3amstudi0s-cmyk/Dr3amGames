// ====== FIREBASE CONFIG ======
// 1. Go to https://console.firebase.google.com -> Create Project
// 2. Build > Realtime Database > Create Database (start in TEST mode for a quick stream event,
//    or lock it down with rules later — see README.md)
// 3. Project settings > General > Your apps > Web app (</>) > copy the config object below
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Password admin types into the Admin tab to unlock controls.
// This is NOT real security (anyone can view source) - fine for a casual stream event.
// For real protection, use Firebase Auth + database rules (see README).
const ADMIN_PASSWORD = "changeme123";

// ====== GAME CONSTANTS ======
const STARTING_CASH = 1000;

const BUSINESSES = {
  lemonstand: { name: "Lemon Stand",  emoji: "🍋", cost: 500,    income: 100  },
  foodtruck:  { name: "Food Truck",   emoji: "🚚", cost: 2000,   income: 400  },
  gamestudio: { name: "Game Studio",  emoji: "🎮", cost: 10000,  income: 2000 },
  bank:       { name: "Bank",         emoji: "🏦", cost: 25000,  income: 5000 }
};
// income = $ earned per minute per unit owned, collected manually via "Collect Income"

const INVESTMENTS = {
  crypto: { name: "Crypto", emoji: "🪙", risk: "High"   },
  stocks: { name: "Stocks", emoji: "📊", risk: "Medium" },
  bonds:  { name: "Bonds",  emoji: "📜", risk: "Low"    }
};
