// ====== FIREBASE CONFIG ======
// 1. Go to https://console.firebase.google.com -> Create Project
// 2. Build > Realtime Database > Create Database (start in TEST mode for a quick stream event,
//    or lock it down with rules later — see README.md)
// 3. Project settings > General > Your apps > Web app (</>) > copy the config object below
// Import the functions you need from the SDKs you need

const firebaseConfig = {
  apiKey: "AIzaSyDQ4tYhsn9AJH9hLnGmCIx6JM27UE6t0vU",
  authDomain: "ai-test-2d1aa.firebaseapp.com",
  databaseURL: "https://ai-test-2d1aa-default-rtdb.firebaseio.com",
  projectId: "ai-test-2d1aa",
  storageBucket: "ai-test-2d1aa.firebasestorage.app",
  messagingSenderId: "871362478836",
  appId: "1:871362478836:web:f1e336fc53c306e6c794a1"
};

// Password admin types into the Admin tab to unlock controls.
// This is NOT real security (anyone can view source) - fine for a casual stream event.
// For real protection, use Firebase Auth + database rules (see README).
const ADMIN_PASSWORD = "PoopyBum1243";

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
